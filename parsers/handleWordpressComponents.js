import visit from 'unist-util-visit';

export function fixLinkButtons() {
  // TODO: Different styles based on _style_as_secondary_button
  const buttnRegex = /<!-- wp:acf\/button ([\s\S]*?) \/-->/;
  return (tree) => {
    visit(tree, 'html', (node) => {
      if (node.value) {
        const match = buttnRegex.exec(node.value);
        if (match) {
          const jsonValue = JSON.parse(match[1]);
          node.value = `{button}[${jsonValue.data.button_text}](${jsonValue.data.link}){/button}`;
        }
      }
    });
  };
}
