function normalize(response: string) {
  return response.replace(/\s+/g, "");
}

// The panel's webapi.cgi answers {"result":"-400","text":"Bad Request"} for
// any api name it does not know. A panel whose user_qrcode answer is identical
// to the answer for a made-up api therefore does not implement user_qrcode
// (firmware 170AC.Cloud V1.8.10 on the AC02C), no matter which parameters are
// sent.
export function isDnakeApiUnsupported(apiResponse: string, unknownApiResponse: string) {
  const answer = normalize(apiResponse);
  return answer !== "" && answer === normalize(unknownApiResponse) && answer.includes('"-400"');
}
