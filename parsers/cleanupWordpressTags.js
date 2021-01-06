import visit from 'unist-util-visit';

export function cleanupParagraphAndHeaderTags() {
  const tagsToRemove = [
    '<!-- wp:paragraph -->',
    '<!-- /wp:paragraph -->',
    '<!-- wp:heading -->',
    '<!-- wp:heading {"level":3} -->',
    '<!-- wp:heading {"level":4} -->',
    '<!-- /wp:heading -->',
    '<!-- /wp:core-embed/youtube -->'];

  const startPatternsToRemove = [
    'https://www.youtube.com/watch?',
    'https://youtu.be/',
  ];

  return (tree) => {
    visit(tree, (node) => {
      if (tagsToRemove.includes(node.value)) {
        node.value = '';
      }
      startPatternsToRemove.forEach((pattern) => {
        if (node.value && node.value.startsWith(pattern)) {
          node.value = '';
        }
      });
    });
  };
}
