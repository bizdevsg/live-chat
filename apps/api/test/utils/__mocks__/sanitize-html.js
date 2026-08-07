// sanitize-html's transitive dependency (htmlparser2) ships pure ESM, which ts-jest's
// CommonJS transform can't load. None of the e2e suites exercise HTML knowledge-document
// upload, so this lightweight stub keeps module resolution working (still valid CommonJS).
module.exports = function sanitizeHtml(html) {
  return String(html).replace(/<[^>]*>/g, "");
};
