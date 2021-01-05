import visit from 'unist-util-visit';

export function fixLinkButtons () {
  // TODO: Different styles based on _style_as_secondary_button
  const buttnRegex = /<!-- wp:acf\/button ([\s\S]*?) \/-->/;
  return (tree) => {
    visit(tree, 'html', (node) => {
      if (node.value) {
        const match = buttnRegex.exec(node.value);
        if (match) {
          const jsonValue = JSON.parse(match[1]);
          if (jsonValue.data.style_as_secondary_button === '1') {
            node.value = `{button secondary}[${jsonValue.data.button_text}](${jsonValue.data.link}){/button}`;
          } else {
            node.value = `{button}[${jsonValue.data.button_text}](${jsonValue.data.link}){/button}`;
          }
        }
      }
    });
  };
}

export function fixAccordions() {
  const accordionRegex = /<!-- wp:acf\/accordion ([\s\S]*?) \/-->/;
  return (tree) => {
    visit(tree, 'html', (node) => {
      if (node.value) {
        const match = accordionRegex.exec(node.value);
        if (match) {
          const jsonValue = JSON.parse(match[1]);
          const { data } = jsonValue;
          let sections = '';
          let index = 0;
          while (data[`section_${index}_heading`]) {
            const heading = data[`section_${index}_heading`];
            const summary = data[`section_${index}_summary`];
            const content = data[`section_${index}_content`];
            sections += `$Heading\n${heading}\n$EndHeading\n$Summary\n${summary}\n$EndSummary\n$Content\n${content}\n$EndContent\n`;
            index += 1;
          }
          node.value = `$Accordion\n${sections}$EndAccordion`;
        }
      }
    });
  };
}

export function fixYoutubeEmbeddings() {
  const youtubeRegex = /<!-- wp:core-embed\/youtube ([\s\S]*?) -->/;
  return (tree) => {
    visit(tree, 'html', (node,) => {
      if (node.value) {
        const match = youtubeRegex.exec(node.value);
        if (match) {
          const jsonValue = JSON.parse(match[1]);
          node.value = `$YoutubeVideo(${jsonValue.url})$YoutubeVideoEnd`;
        }
      }
    });
  };
}
