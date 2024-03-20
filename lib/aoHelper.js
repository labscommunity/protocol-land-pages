const {getWallet, log, AOS_PROCESS_ID} = require('./common.js');
const {
  createDataItemSigner,
  dryrun,
  message,
  result,
} = require('@permaweb/aoconnect');

function capitalizeFirstLetter(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function getTags(payload) {
  return Object.entries(payload).map(([key, value]) => ({
    name: capitalizeFirstLetter(key),
    value,
  }));
}

function extractMessage(text) {
  const regex = /:\s*([^:!]+)!/;
  const match = text.match(regex);
  return match ? match[1].trim() : text;
}

async function sendMessage({tags, data}) {
  const args = {
    process: AOS_PROCESS_ID,
    tags,
    signer: createDataItemSigner(getWallet()),
  };

  if (data) {
    args.data = data;
  }

  const messageId = await message(args);

  const {Output} = await result({
    message: messageId,
    process: AOS_PROCESS_ID,
  });

  if (Output?.data?.output) {
    throw new Error(extractMessage(Output?.data?.output));
  }

  return messageId;
}

async function getRepoFromPL(repoUrl) {
  const id = `${repoUrl.replace(/.*:\/\//, '')}`;
  const {Messages} = await dryrun({
    process: AOS_PROCESS_ID,
    tags: getTags({
      Action: 'Get-Repository',
      Id: id,
      Fields: JSON.stringify([
        'id',
        'name',
        'description',
        'owner',
        'deployments',
        'deploymentBranch',
        'contributors',
      ]),
    }),
  });

  return JSON.parse(Messages[0].Data)?.result;
}

async function updateDeploymentBranch(repo, deploymentBranch) {
  if (!repo.id) {
    throw '[ AO ] No id to update repo ';
  }

  await sendMessage({
    tags: getTags({
      Action: 'Update-Repository-Details',
      Id: repo.id,
      DeploymentBranch: deploymentBranch,
    }),
  });
}

async function addDeployment(repo, deployment) {
  if (!repo.id) {
    throw '[ AO ] No id to update repo ';
  }

  await sendMessage({
    tags: getTags({
      Action: 'Add-Deployment',
      Id: repo.id,
      Deployment: JSON.stringify(deployment),
    }),
  });

  log(`Deployment Link: https://ar-io.net/${deployment.txId}\n`, {
    color: 'green',
  });
}

exports.addDeployment = addDeployment;
exports.updateDeploymentBranch = updateDeploymentBranch;
exports.getRepoFromPL = getRepoFromPL;
