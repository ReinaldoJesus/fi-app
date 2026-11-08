/**
 * Personal URL for iPhone Shortcuts: POST /api/v1/shortcuts/<token> with
 * { amount, merchant, card }. The token in the path means nothing to set up
 * besides the URL; the answer is plain text for "Show notification".
 */
export { POST } from "../transaction/route"
