import xml2js from 'xml2js';
import fs from 'fs';

import { processPost } from './processPage';

export function processExport(files) {
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
