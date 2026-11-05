const { URNERYS, GITHUB_RUN_ID, GITHUB_REPOSITORY, GITHUB_SHA } = process.env;

const res = await fetch(`https://${URNERYS}/rpc/moveBaseline`, {
  method: "POST",
  body: JSON.stringify({
    project: GITHUB_REPOSITORY.split('/')[1],
    baseline: "production",
    build: GITHUB_RUN_ID,
  }),
});

console.log("moveBaseline", res.status);
console.log(await res.text());
