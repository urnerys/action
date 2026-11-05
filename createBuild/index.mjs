const { URNERYS, GITHUB_RUN_ID, GITHUB_REPOSITORY, GITHUB_SHA } = process.env

const res = await fetch(`https://${URNERYS}/rpc/createBuild`, {
  method: "POST",
  body: JSON.stringify({
    project: GITHUB_REPOSITORY.split('/')[1],
    build: GITHUB_RUN_ID,
    commit: GITHUB_SHA
  }),
});

console.log("createBuild", res.status);
console.log(await res.text());
