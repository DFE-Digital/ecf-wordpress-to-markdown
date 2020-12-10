import visit from 'unist-util-visit';

export function cleanupParagraphAndHeaderTags() {
  const tagsToRemove = [
    '<!-- wp:paragraph -->',
    '<!-- /wp:paragraph -->',
    '<!-- wp:heading -->',
    '<!-- /wp:heading -->'];

  return (tree) => {
    visit(tree, 'html', (node) => {
      if (tagsToRemove.includes(node.value)) {
        node.value = '';
      }
    });
  };
}
