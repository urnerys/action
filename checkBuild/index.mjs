const { URNERYS, GITHUB_RUN_ID, GITHUB_REPOSITORY } = process.env

const res = await fetch(`https://${URNERYS}/rpc/checkBuild`, {
  method: "POST",
  body: JSON.stringify({
    project: GITHUB_REPOSITORY.split('/')[1],
    build: GITHUB_RUN_ID,
    baseline: "production"
  }),
});

console.log("checkBuild", res.status);
console.log(await res.text());
