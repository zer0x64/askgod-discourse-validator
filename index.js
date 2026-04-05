const fs = require("fs");
const { globSync } = require("glob");
const yaml = require("js-yaml");
const core = require("@actions/core");

const path = core.getInput("path_to_files") || process.env.PATH_TO_FILES;
const validUsers = (core.getInput("api_users") || process.env.API_USERS || '')
  .split(",")
  .filter((u) => !!u);

const files = globSync([`${path}/*.{yml,yaml}`]);

files
  .map((file) => {
    try {
      const content = yaml.load(fs.readFileSync(file, "utf8"));
      return [file, content];
    } catch (error) {
      fail(`Error parsing file ${file} : ${error}`);
    }
  })
  .forEach(([file, content]) => {
    switch (content.type) {
      case "topic":
        parseTopic(file, content);
        break;
      case "post":
        parsePost(file, content);
        break;
      case "posts":
        parsePosts(file, content);
        break;
      default:
        fail(
          `File ${file} must be of type "topic" or "post", found ${content.type}`
        );
    }
  });

function parseTopic(fileName, content) {
  const { title, body, api, trigger } = content;
  if (!title || !body) {
    fail(`File ${fileName} with type topic must have a title and body`);
  }

  parseAPIUser(fileName, api);
  parseTrigger(fileName, trigger);
}

function parsePost(fileName, content) {
  const { topic, body, trigger, api } = content;
  if (!topic || !body) {
    fail(`File ${fileName} with type post must have a topic and body`);
  }

  if (!globSync(`${path}/${topic}.{yml,yaml}`)) {
    fail(
      `File ${fileName} has an invalid topic, ${topic}.yaml does not exist `
    );
  }

  parseAPIUser(fileName, api);
  parseTrigger(fileName, trigger);
}

function parsePosts(fileName, content) {
  const { topic, posts, trigger, api } = content;
  if (!topic) {
    fail(`File ${fileName} with type posts must have a topic`);
  }

  posts.forEach(({ body, api: subApi }) => {
    if (!body) {
      fail(`File ${fileName} with type posts have a post without a body`);
    }

    parseAPIUser(fileName, subApi);
  })

  if (!globSync(`${path}/${topic}.{yml,yaml}`)) {
    fail(
      `File ${fileName} has an invalid topic, ${topic}.yaml does not exist `
    );
  }

  if (api) parseAPIUser(fileName, api);
  parseTrigger(fileName, trigger);
}

function parseAPIUser(fileName, api) {
  if (!api || !api.user) {
    fail(`File ${fileName} is missing the "api.user" entry`);
  }

  if (validUsers.length > 0 && !validUsers.includes(api.user)) {
    fail(
      `File ${fileName} has an invalid API user ${api.user}, must be one of ${validUsers}`
    );
  }
}

function parseTrigger(fileName, trigger) {
  if (!trigger) {
    return;
  }

  switch (trigger.type) {
    case "flag":
      if (!trigger.tag)
        fail(
          `File ${fileName} is using a flag trigger, but is missing "tag" field`
        );
      break;
    case "timer":
      if (!trigger.after)
        fail(
          `File ${fileName} is using a timer trigger, but is missing "after" field`
        );
      break;
    case "score":
      if (!trigger.value)
        fail(
          `File ${fileName} is using a score trigger, but is missing "value" field`
        );
      break;
    default:
      fail(
        `File ${fileName} has an invalid trigger type ${trigger.type}, must be one of flag, timer, score`
      );
  }
}

function fail(message) {
  core.setFailed(message);
  process.exit(1);
}
