import pkg from 'date-fns';
import prettier from 'prettier';
import fs from 'fs';
import slugify from 'slugify';
import unified from 'unified';
import parseHTML from 'rehype-parse';
import rehype2remark from 'rehype-remark';
import stringify from 'remark-stringify';

import {
  cleanupShortcodes,
  fixCodeBlocks,
  fixBadHTML,
  fixEmbeds,
} from '../parsers/forkedMagicalParsers';
import { cleanupParagraphAndHeaderTags } from '../parsers/cleanupWordpressTags';
import { fixLinkButtons, fixAccordions, fixYoutubeEmbeddings } from '../parsers/handleWordpressComponents';
import { processImage, processImages } from './processImages';

const { format } = pkg;

function parseMarkdown(postData) {
  return new Promise((resolve, reject) => {
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
      .use(fixLinkButtons)
      .use(fixAccordions)
      .use(fixYoutubeEmbeddings)
      .use(cleanupParagraphAndHeaderTags)
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
}

export async function processPost(post, outPath) {
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

  const markdown = await parseMarkdown(postData);

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
