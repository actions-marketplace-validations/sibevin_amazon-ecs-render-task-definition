const path = require('path');
const core = require('@actions/core');
const tmp = require('tmp');
const fs = require('fs');

async function run() {
  try {
    // Get inputs
    const taskDefinitionFile = core.getInput('task-definition', { required: true });
    const containerName = core.getInput('container-name', { required: true });
    const imageURI = core.getInput('image', { required: true });
    const overwrittenEnvList = core.getInput('overwritten-envs');

    // Parse the task definition
    const taskDefPath = path.isAbsolute(taskDefinitionFile) ?
      taskDefinitionFile :
      path.join(process.env.GITHUB_WORKSPACE, taskDefinitionFile);
    if (!fs.existsSync(taskDefPath)) {
      throw new Error(`Task definition file does not exist: ${taskDefinitionFile}`);
    }
    const taskDefContents = require(taskDefPath);

    // Insert the image URI
    if (!Array.isArray(taskDefContents.containerDefinitions)) {
      throw new Error('Invalid task definition format: containerDefinitions section is not present or is not an array');
    }
    const containerDef = taskDefContents.containerDefinitions.find(function(element) {
      return element.name == containerName;
    });
    if (!containerDef) {
      throw new Error('Invalid task definition: Could not find container definition with matching name');
    }
    containerDef.image = imageURI;

    // Setup container environment
    if (overwrittenEnvList != '') {
      const oriEnvs = containerDef.environment;
      let overwrittenEnvNames = overwrittenEnvList.split(',');
      const newEnvs = [];
      oriEnvs.forEach((oriEnv) => {
        const oriEnvName = oriEnv['name'];
        const foundNameIndex = overwrittenEnvNames.indexOf(oriEnvName);
        if (foundNameIndex >= 0) {
          newEnvs.push({ name: oriEnvName, value: process.env[oriEnvName] });
          overwrittenEnvNames.splice(foundNameIndex, 1);
        } else {
          newEnvs.push(oriEnv);
        }
      });
      overwrittenEnvNames.forEach((newEnvName) => {
        newEnvs.push({ name: newEnvName, value: process.env[newEnvName] });
      });
      containerDef.environment = newEnvs;
    }

    // Write out a new task definition file
    var updatedTaskDefFile = tmp.fileSync({
      tmpdir: process.env.RUNNER_TEMP,
      prefix: 'task-definition-',
      postfix: '.json',
      keep: true,
      discardDescriptor: true
    });
    const newTaskDefContents = JSON.stringify(taskDefContents, null, 2);
    fs.writeFileSync(updatedTaskDefFile.name, newTaskDefContents);
    core.setOutput('task-definition', updatedTaskDefFile.name);
  }
  catch (error) {
    core.setFailed(error.message);
  }
}

module.exports = run;

/* istanbul ignore next */
if (require.main === module) {
    run();
}
