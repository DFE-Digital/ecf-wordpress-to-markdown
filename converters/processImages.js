import fetch from 'node-fetch';
import path from 'path';
import fs from 'fs';
import htmlentities from 'he';
import imageType from 'image-type';

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

export async function processImage({
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

export async function processImages({ postData, directory, outPath }) {
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
