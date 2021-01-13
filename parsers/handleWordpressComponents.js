import visit from 'unist-util-visit';

export function fixLinkButtons() {
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

export function fixHighlights() {
  const highlightRegex = /<!-- wp:acf\/highlight ([\s\S]*?) \/-->/;
  return (tree) => {
    visit(tree, 'html', (node) => {
      if (node.value) {
        const match = highlightRegex.exec(node.value);
        if (match) {
          const jsonValue = JSON.parse(match[1]);
          node.value = `$I\n${jsonValue.data.highlight_content}\n$I`;
        }
      }
    });
  };
}

export function fixActionPrompt() {
  const actionPromptRegex = /<!-- wp:acf\/action-prompt ([\s\S]*?) \/-->/;
  return (tree) => {
    visit(tree, 'html', (node) => {
      if (node.value) {
        const match = actionPromptRegex.exec(node.value);
        if (match) {
          const jsonValue = JSON.parse(match[1]);
          node.value = `$CTA\n${jsonValue.data.action_prompt_content}\n$CTA`;
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

const findCaptionText = (figureCaption, key) => {
  let figCaptionValue = '';
  const nestedFigCap = figureCaption.filter((o) => o.type === key);
  if (nestedFigCap.length > 0) {
    figCaptionValue = nestedFigCap[0].value;
  } else {
    const string = findCaptionText(figureCaption[0].children, key);
    if (string) {
      figCaptionValue += string;
    }
  }
  return figCaptionValue;
};

export function findImageData() {
  return (tree) => {
    visit(tree, (node) => node.type === 'element' && node.children.some((n) => n.tagName === 'img'), (node) => {
      const arrayOfImageData = node.children.filter((imageData) => imageData.tagName === 'img');
      const { src } = arrayOfImageData[0].properties;
      const { alt } = arrayOfImageData[0].properties;

      const figureCaption = node.children.filter((element) => element.tagName === 'figcaption');

      let captionText = '';
      if (figureCaption.length > 0) {
        captionText = findCaptionText(figureCaption, 'text');
      } else captionText = '';

      const govSpeakImageData = `$Alt\n${alt}\n$EndAlt\n$URL\n${src}\n$EndURL\n$Caption\n${captionText}\n$EndCaption`;

      node.type = 'element';
      node.tagName = 'div';
      node.children = [{
        type: 'text', value: govSpeakImageData,
      }];
    });
  };
}

export function fixImages() {
  return (tree) => {
    visit(tree, 'text', (node) => {
      if (node.value.includes('$EndAlt')) {
        const govSpeakImageData = node.value;
        node.value = `$Figure\n${govSpeakImageData}\n$EndFigure`;
      }
    });
  };
}

export function fixYoutubeEmbeddings() {
  const youtubeRegex = /<!-- wp:core-embed\/youtube ([\s\S]*?) -->/;
  return (tree) => {
    visit(tree, 'html', (node) => {
      if (node.value) {
        const match = youtubeRegex.exec(node.value);
        if (match) {
          const jsonValue = JSON.parse(match[1]);
          node.value = `$YoutubeVideo(${jsonValue.url})$EndYoutubeVideo`;
        }
      }
    });
  };
}
