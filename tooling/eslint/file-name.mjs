import path from "node:path";

// Dot suffixes cover Next.js metadata variants, declarations and test/config files.
const fileName = /^[a-z0-9]+(?:[-.][a-z0-9]+)*\.(?:[cm]?[jt]sx?)$/;

const fileNameRule = {
  meta: {
    type: "suggestion",
    schema: [],
    messages: {
      kebabCase: "Use a lowercase kebab-case file name (dot suffixes such as .test.ts are allowed).",
    },
  },
  create(context) {
    return {
      Program(node) {
        if (!fileName.test(path.basename(context.filename))) {
          context.report({ node, messageId: "kebabCase" });
        }
      },
    };
  },
};

export default fileNameRule;
