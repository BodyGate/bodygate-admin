import assert from "node:assert/strict";
import { deriveControllerCodeFromRawBadge, getAccessCodeVariants, normalizeAccessCode } from "../accessCodeNormalizer";

assert.equal(deriveControllerCodeFromRawBadge("51006b659d"), "7038365");
assert.deepEqual(getAccessCodeVariants("51006b659d"), ["51006b659d", "7038365"]);
assert.deepEqual(getAccessCodeVariants("095629"), ["095629", "95629"]);
assert.deepEqual(getAccessCodeVariants("95629"), ["95629"]);
assert.deepEqual(getAccessCodeVariants("00095629"), ["00095629", "95629"]);

const qr = normalizeAccessCode("local_user=YXJSWERTDglPDEN3AVVcAmc=");
assert.equal(qr.controllerCode, null);
assert.deepEqual(qr.variants, ["local_user=YXJSWERTDglPDEN3AVVcAmc="]);

console.log("accessCodeNormalizer tests passed");
