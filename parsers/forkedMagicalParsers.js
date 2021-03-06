import visit from 'unist-util-visit';
import htmlentities from 'he';
import toHTML from 'hast-util-to-html';
import prettier from 'prettier';
import util from 'util';

export function fixBadHTML(html) {
  const tagsToRemove = [
    /<!-- wp:block \{"ref":[0-9]+} \/-->/g,

    /<!-- wp:paragraph -->/g,
    /<!-- wp:paragraph {"align":"[a-zA-Z]+"} -->/g,
    /<!-- wp:paragraph {"className":"[a-zA-Z\-]+"} -->/g,
    /<!-- \/wp:paragraph -->/g,
    /<!-- \\\/wp:paragraph -->/g,

    /<!-- wp:heading -->/g,
    /<!-- wp:heading {"level":[0-9]+} -->/g,
    /<!-- \/wp:heading -->/g,
    /<!-- \\\/wp:heading -->/g,

    /<!-- wp:quote -->/g,
    /<!-- wp:quote {"align":"left"} -->/,
    /<!-- \/wp:quote -->/g,
    /<!-- \\\/wp:quote -->/g,

    /<!-- wp:list -->/g,
    /<!-- wp:list {[a-zA-Z":,0-9]+} -->/g,
    /<!-- \/wp:list -->/g,
    /<!-- \\\/wp:list -->/g,

    /<!-- wp:table -->/g,
    /<!-- \/wp:table -->/g,
    /<!-- \\\/wp:table -->/g,

    /<!-- wp:tadv\/classic-paragraph -->/g,
    /<!-- \/wp:tadv\/classic-paragraph -->/g,
    /<!-- \\\/wp:tadv\/classic-paragraph -->/g,

    /<!-- wp:spacer -->/g,
    /<!-- \/wp:spacer -->/g,
    /<!-- \\\/wp:spacer -->/g,

    /<!-- wp:separator -->/g,
    /<!-- \/wp:separator -->/g,
    /<!-- \\\/wp:separator -->/g,

    /<!-- wp:html -->/g,
    /<!-- \/wp:html -->/g,
    /<!-- \\\/wp:html -->/g,

    /<!-- wp:group -->/g,
    /<!-- \/wp:group -->/g,
    /<!-- \\\/wp:group -->/g,

    /<!-- wp:image -->/g,
    /<!-- wp:image {[a-zA-Z":,0-9]+} -->/g,
    /<!-- \/wp:image -->/g,
    /<!-- \\\/wp:image -->/g,
  ];

  html = html.replace(/(\r?\n){2}/g, '<p></p>');
  html = html.replace(/ <\/em>/g, '</em> ');
  html = html.replace(/ <\/strong>/g, '</strong> ');

  tagsToRemove.forEach((tag) => {
    html = html.replace(tag, '');
  });

  return html;
}

// this is a remark plugin
export function cleanupShortcodes() {
  const shortCodeOpenTag = /\[\w+ .*\]/g;
  const shortCodeCloseTag = /\[\/\w+]/g;
  const embedShortCode = /\[\w+ (https?:\/\/.*)\]/g;
  const captionShortCode = /\[caption.*\]/g;

  return (tree) => {
    visit(tree, 'text', (node, _index, parent) => {
      if (parent.type === 'paragraph' && node.value) {
        // preserve embed shortcodes as plain URLs
        if (node.value.match(embedShortCode)) {
          node.value = node.value.replace(embedShortCode, '$1');
        }

        // turn [caption] shortcodes into clean images
        if (node.value.match(captionShortCode)) {
          visit(parent, 'text', (parentNode) => {
            parentNode.value = '';
          });
          visit(parent, 'link', (parentNode) => {
            parentNode.type = 'image';
            parentNode.title = parentNode.children[0].title;
            parentNode.alt = parentNode.children[0].alt;
            parentNode.url = parentNode.children[0].url;
            parentNode.children = [];
          });
        }

        // remove other shortcodes
        node.value = node.value
          .replace(shortCodeOpenTag, '')
          .replace(shortCodeCloseTag, '');
      }
    });
  };
}

export function findRehypeNodes(node, tagName) {
  const nodes = [];

  if (node.tagName === tagName) {
    nodes.push(node);
  } else if (node.children) {
    node.children.forEach((child) => {
      nodes.push(...findRehypeNodes(child, tagName));
    });
  }

  return nodes;
}

// this is a rehype plugin
export function fixCodeBlocks() {
  const settings = {
    quoteSmart: false,
    closeSelfClosing: false,
    omitOptionalTags: false,
    entities: { useShortestReferences: true },
  };

  function cleanBlockHTML(html, lang) {
    html = html
      .replace('</pre>', '')
      .replace(/\<pre.*?>/, '')
      .replace(/\<p\>\<\/p\>/g, '\n\n')
      .replace(/^<code>/, '')
      .replace(/<\/code>$/, '');
    html = htmlentities.decode(html);

    while (html.match(/\<(.+\w+)="\{(.*)\}"(.*)\>/)) {
      html = html.replace(/\<(.+\w+)="\{(.*)\}"(.*)\>/, '<$1={$2}$3>');
    }

    html = html.replace(/&#39;/g, '"').replace(/&#34;/g, '"');

    try {
      switch (lang) {
        case 'js':
        case 'javascript':
          html = prettier.format(html, { parser: 'babel' });
          break;
        case 'ts':
        case 'typescript':
          html = prettier.format(html, { parser: 'babel-ts' });
          break;
        case 'css':
        case 'less':
        case 'scss':
        case 'graphql':
        case 'html':
        case 'markdown':
        case 'mdx':
        case 'vue':
        case 'angular':
        case 'lwc':
        case 'yaml':
          html = prettier.format(html, { parser: lang });
          break;
        default:
          throw new Error('Incorrect format');
      }
    } catch (e) {
      console.log(`----- ERROR PRETTIFYING ${lang}`);
      console.log(html);
    }

    return html;
  }

  // fix props with prop={{ ... }} notation
  // parsed into a mess of attributes style='{{', 'border:'='' ... '}}': ''
  function fixJsxObjectProps(tree) {
    if (tree.type === 'element' && tree.properties) {
      // bad props start with a broken prop='{{'
      if (Object.values(tree.properties).some((val) => val === '{{')) {
        const props = [];
        let collecting = false;
        let prop; let
          propVal;
        Object.entries(tree.properties).forEach(([key, val]) => {
          if (val === '{{') {
            // the next several props are part of the object
            collecting = true;
            prop = key;
            propVal = [val];
          } else if (collecting) {
            // collect props
            propVal.push(`${key} ${val}`);

            if (key.includes('}}') || val.includes('}}')) {
              // stop collecting when done
              props.push([
                prop,
                propVal
                  .join(' ')
                  .replace(/[ ]{2,}/g, ' ')
                  .trim(),
              ]);
              collecting = false;
            }
          } else {
            props.push([key, val]);
          }
        });

        tree.properties = Object.fromEntries(props);
      }
    }

    if (tree.children) {
      tree.children = tree.children.map(fixJsxObjectProps);
    }

    return tree;
  }

  return (tree) => {
    const codeBlocks = findRehypeNodes(tree, 'pre');
    codeBlocks.forEach((block) => {
      const lang = block.properties && block.properties.lang;

      block.children = [
        {
          type: 'element',
          tagName: 'code',
          properties: {
            className: lang ? [`language-${lang}`] : null,
          },
          children: [
            {
              type: 'text',
              value: cleanBlockHTML(
                toHTML(fixJsxObjectProps(block), settings),
                block.properties && block.properties.lang,
              ),
            },
          ],
        },
      ];
    });

    return tree;
  };
}

// this is a rehype plugin
// changes iframe and blockquote embeds to regular links
export function fixEmbeds() {
  function isEmbeddable(iframe) {
    return iframe.properties.src.match(
      /^http(s)?:\/\/(www\.)?(youtube|youtu.be|codesandbox|codepen)/,
    );
  }

  function isTweet(blockquote) {
    return (
      blockquote.properties
            && blockquote.properties.className
            && blockquote.properties.className.includes('twitter-tweet')
    );
  }

  function isInstagram(blockquote) {
    return (
      blockquote.properties
            && blockquote.properties.className
            && blockquote.properties.className.includes('instagram-media')
    );
  }

  function isCodepen(paragraph) {
    return (
      paragraph.properties
            && paragraph.properties.className
            && paragraph.properties.className.includes('codepen')
    );
  }

  function fixIframeLink(src) {
    if (src.match(/(youtube\.com|youtu\.be)\/embed\//)) {
      return src.replace('/embed/', '/watch?v=');
    } if (src.match(/codesandbox/)) {
      return src.replace('/embed/', '/s/');
    }
    return src;
  }

  return (tree) => {
    const iframes = findRehypeNodes(tree, 'iframe');
    const blockquotes = findRehypeNodes(tree, 'blockquote');
    const paragraphs = findRehypeNodes(tree, 'p');

    iframes.forEach((iframe) => {
      if (isEmbeddable(iframe)) {
        iframe.type = 'element';
        iframe.tagName = 'p';
        iframe.children = [
          {
            type: 'text',
            value: fixIframeLink(iframe.properties.src),
          },
        ];
      }
    });

    blockquotes.forEach((blockquote) => {
      if (isTweet(blockquote)) {
        const link = findRehypeNodes(blockquote, 'a').pop();
        blockquote.type = 'element';
        blockquote.tagName = 'p';
        blockquote.children = [
          { type: 'text', value: link.properties.href },
        ];
      } else if (isInstagram(blockquote)) {
        blockquote.type = 'element';
        blockquote.tagName = 'p';

        let link = blockquote.properties.dataInstgrmPermalink;
        if (!link) {
          link = findRehypeNodes(blockquote, 'a').shift();
        }

        try {
          blockquote.children = [
            {
              type: 'text',
              value: link.split('?')[0],
            },
          ];
        } catch (e) {
          console.log('---- BAD INSTA');
          console.log(
            util.inspect(blockquote, false, null, true),
          );
          throw e;
        }
      }
    });

    paragraphs.forEach((paragraph) => {
      if (isCodepen(paragraph)) {
        const link = findRehypeNodes(paragraph, 'a').shift();
        paragraph.children = [
          {
            type: 'text',
            value: link.properties.href,
          },
        ];
      }
    });

    return tree;
  };
}
