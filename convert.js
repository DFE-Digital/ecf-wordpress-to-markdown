import pkg from 'date-fns';
import fetch from 'node-fetch';
import path from 'path';
import prettier from 'prettier';
import xml2js from 'xml2js';
import fs from 'fs';
import slugify from 'slugify';
import htmlentities from 'he';
import unified from 'unified';
import parseHTML from 'rehype-parse';
import rehype2remark from 'rehype-remark';
import stringify from 'remark-stringify';
import imageType from 'image-type';

import {
  cleanupShortcodes,
  fixCodeBlocks,
  fixBadHTML,
  fixEmbeds,
} from './parsers/forkedMagicalParsers';
import { cleanupParagraphAndHeaderTags } from './parsers/cleanupWordpressTags';
import { fixLinkButtons } from './parsers/handleWordpressComponents';

const { format } = pkg;

async function downloadFile(url) {
  const response = await fetch(url);
  if (response.status >= 400) {
    throw new Error('Bad response from server');
  } else {
    return response;
  }
}

function constructImageName({ urlParts, buffer }) {
  const pathParts = path.parse(
    urlParts.pathname
      .replace(/^\//, '')
      .replace(/\//g, '-')
      .replace(/\*/g, ''),
  );
  const { ext } = imageType(Buffer.from(buffer));

  return `${pathParts.name}.${ext}`;
}

async function processImage({
  url, postData, images, directory, outPath,
}) {
  const cleanUrl = htmlentities.decode(url);

  if (cleanUrl.startsWith('./img')) {
    console.log(`Already processed ${cleanUrl} in ${directory}`);

    return [postData, images];
  }

  const urlParts = new URL(cleanUrl);

  const filePath = `${outPath}/${directory}/img`;

  try {
    const response = await downloadFile(cleanUrl);
    const type = response.headers.get('Content-Type');

    if (type.includes('image') || type.includes('octet-stream')) {
      const buffer = await response.arrayBuffer();
      const imageName = constructImageName({
        urlParts,
        buffer,
      });

      // Make the image name local relative in the markdown
      postData = postData.replace(url, `./img/${imageName}`);
      images = [...images, `./img/${imageName}`];

      fs.writeFileSync(`${filePath}/${imageName}`, Buffer.from(buffer));
    }
  } catch (e) {
    console.log(`Keeping ref to ${url}`);
  }

  return [postData, images];
}

async function processImages({ postData, directory, outPath }) {
  const patt = new RegExp('(?:src="(.*?)")', 'gi');
  let images = [];

  let m;
  const matches = [];

  m = patt.exec(postData);
  while (m !== null) {
    if (!m[1].endsWith('.js')) {
      matches.push(m[1]);
    }
    m = patt.exec(postData);
  }

  if (matches != null && matches.length > 0) {
    matches.forEach(async (match) => {
      try {
        [postData, images] = await processImage({
          url: match,
          postData,
          images,
          directory,
          outPath,
        });
      } catch (err) {
        console.log('ERROR PROCESSING IMAGE', match);
      }
    });
  }

  return [postData, images];
}

async function processPost(post, outPath) {
  console.log('Processing Post');

  const postTitle = typeof post.title === 'string' ? post.title : post.title[0];
  console.log(`Post title: ${postTitle}`);
  const postDate = Number(new Date(post.pubDate)).isFinite
    ? new Date(post.pubDate)
    : new Date(post['wp:post_date']);
  console.log(`Post Date: ${postDate}`);
  let postData = post['content:encoded'][0];
  console.log(`Post length: ${postData.length} bytes`);
  const slug = slugify(postTitle, {
    remove: /[^\w\s]/g,
  })
    .toLowerCase()
    .replace(/\*/g, '');
  console.log(`Post slug: ${slug}`);

  // takes the longest description candidate
  const metadata = post['wp:postmeta'] ? post['wp:postmeta'] : [];
  const description = [
    post.description,
    ...metadata.filter(
      (meta) => meta['wp:meta_key'][0].includes('metadesc')
                || meta['wp:meta_key'][0].includes('description'),
    ),
  ].sort((a, b) => b.length - a.length)[0];

  const heroURLs = metadata
    .filter(
      (meta) => meta['wp:meta_key'][0].includes('opengraph-image')
                || meta['wp:meta_key'][0].includes('twitter-image'),
    )
    .map((meta) => meta['wp:meta_value'][0])
    .filter((url) => url.startsWith('http'));

  let heroImage = '';

  let directory = slug;
  const fname = 'index.mdx';

  try {
    fs.mkdirSync(`${outPath}/${directory}`);
    fs.mkdirSync(`${outPath}/${directory}/img`);
  } catch (e) {
    directory = `${directory}-2`;
    fs.mkdirSync(`${outPath}/${directory}`);
    fs.mkdirSync(`${outPath}/${directory}/img`);
  }

  // Merge categories and tags into tags
  const categories = post.category && post.category.map((cat) => cat._);

  // Find all images
  let images = [];
  if (heroURLs.length > 0) {
    const url = heroURLs[0];
    [postData, images] = await processImage({
      url,
      postData,
      images,
      directory,
    });
  }

  [postData, images] = await processImages({ postData, directory, outPath });

  heroImage = images.find((img) => !img.endsWith('gif'));

  const markdown = await new Promise((resolve, reject) => {
    unified()
      .use(parseHTML, {
        fragment: true,
        emitParseErrors: true,
        duplicateAttribute: false,
      })
      .use(fixCodeBlocks)
      .use(fixEmbeds)
      .use(rehype2remark)
      .use(cleanupShortcodes)
      .use(cleanupParagraphAndHeaderTags)
      .use(fixLinkButtons)
      .use(stringify, {
        fences: true,
        listItemIndent: 1,
        gfm: false,
        pedantic: false,
      })
      .process(fixBadHTML(postData), (err, dirtyMarkdown) => {
        if (err) {
          reject(err);
        } else {
          // actual mdx string
          let content = dirtyMarkdown.contents;
          content = content.replace(
            /(?<=https?:\/\/.*)\\_(?=.*\n)/g,
            '_',
          );
          resolve(prettier.format(content, { parser: 'mdx' }));
        }
      });
  });

  try {
    postTitle.replace('\\', '\\\\').replace(/"/g, '\\"');
  } catch (e) {
    console.log('FAILED REPLACE', postTitle);
  }

  const redirectFrom = post.link[0]
    .replace('https://swizec.com', '')
    .replace('https://www.swizec.com', '');
  let frontmatter;
  try {
    frontmatter = [
      '---',
      `title: '${postTitle.replace(/'/g, "''")}'`,
      `description: "${description}"`,
      `published: ${format(postDate, 'yyyy-MM-dd')}`,
      `redirectFrom: 
            - ${redirectFrom}`,
    ];
  } catch (e) {
    console.log('----------- BAD TIME', postTitle, postDate);
    throw e;
  }

  if (categories && categories.length > 0) {
    frontmatter.push(`categories: "${categories.join(', ')}"`);
  }

  frontmatter.push(`hero: ${heroImage || '../../../defaultHero.jpg'}`);
  frontmatter.push('---');
  frontmatter.push('');

  fs.writeFile(
    `${outPath}/${directory}/${fname}`,
    frontmatter.join('\n') + markdown,
    () => {},
  );
}

function processExport(files) {
  files.forEach((file) => {
    const { filePath, name } = file;
    const parser = new xml2js.Parser();
    const outPath = `out-${name}`;

    fs.readFile(filePath, (fileError, data) => {
      if (fileError) {
        return console.log(`Error: ${fileError}`);
      }

      parser.parseString(data, (dataError, result) => {
        if (dataError) {
          return console.log(`Error parsing xml: ${dataError}`);
        }
        console.log('Parsed XML');

        const posts = result.rss.channel[0].item;

        fs.mkdir(outPath, () => {
          posts
            .filter((p) => p['wp:post_type'][0] === 'page')
            .forEach((p) => processPost(p, outPath));
        });
      });
    });
  });
}

processExport([
  {
    filePath: 'in-edt.xml',
    name: 'edt',
  },
  {
    filePath: 'in-ambition.xml',
    name: 'ambition',
  },
  {
    filePath: 'in-teachfirst.xml',
    name: 'teachfirst',
  },
  {
    filePath: 'in-ucl.xml',
    name: 'ucl',
  },
  {
    filePath: 'in-common.xml',
    name: 'common',
  },
]);
