import assert from "node:assert/strict";
import test from "node:test";

import {
  DnakeUserDirectoryError,
  dnakeDirectoryContainsUserId,
  dnakeLocalUserCount,
  isDnakeDirectoryEmpty,
} from "../app/lib/server/dnakeUserDirectory.ts";
import { isDnakeApiUnsupported } from "../app/lib/server/dnakePanelCapabilities.ts";

test("an empty or whitespace-only users file is detected as empty", () => {
  assert.equal(isDnakeDirectoryEmpty(""), true);
  assert.equal(isDnakeDirectoryEmpty("﻿ \r\n"), true);
  assert.equal(isDnakeDirectoryEmpty("<users/>"), false);
});

test("the directory lookup itself still refuses an empty file", () => {
  assert.throws(() => dnakeDirectoryContainsUserId("", "000001"), DnakeUserDirectoryError);
});

test("local user count reads the api=user answer of the 170AC.Cloud firmware", () => {
  const answer = '{\n\t"local_file":\t"/data/users.xml",\n\t"local_cnt":\t"0",\n\t"cloud_cnt":\t"1"\n}';
  assert.equal(dnakeLocalUserCount(answer), 0);
  assert.equal(dnakeLocalUserCount('{"local_cnt":"3"}'), 3);
  assert.equal(dnakeLocalUserCount('{"local_cnt":2}'), 2);
});

test("local user count fails closed on anything it cannot trust", () => {
  assert.throws(() => dnakeLocalUserCount("not json"), DnakeUserDirectoryError);
  assert.throws(() => dnakeLocalUserCount("{}"), DnakeUserDirectoryError);
  assert.throws(() => dnakeLocalUserCount('{"local_cnt":""}'), DnakeUserDirectoryError);
  assert.throws(() => dnakeLocalUserCount('{"local_cnt":"abc"}'), DnakeUserDirectoryError);
  assert.throws(() => dnakeLocalUserCount('{"local_cnt":"-1"}'), DnakeUserDirectoryError);
  assert.throws(() => dnakeLocalUserCount("null"), DnakeUserDirectoryError);
});

test("user_qrcode is unsupported when it answers like a made-up api", () => {
  const unknown = '{"result":"-400", "text":"Bad Request"}';
  assert.equal(isDnakeApiUnsupported('{"result":"-400",\n"text":"Bad Request"}', unknown), true);
});

test("user_qrcode is supported when it answers differently from a made-up api", () => {
  const unknown = '{"result":"-400", "text":"Bad Request"}';
  assert.equal(isDnakeApiUnsupported('{"qrcode":"local_user=YXJS"}', unknown), false);
  assert.equal(isDnakeApiUnsupported('{"result":"0"}', '{"result":"0"}'), false);
  assert.equal(isDnakeApiUnsupported("", ""), false);
});
