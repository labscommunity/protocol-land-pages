const path = require('path');
const {
  LoggerFactory,
  WarpFactory,
  defaultCacheOptions,
} = require('warp-contracts');
const {
  PL_TMP_PATH,
  getWallet,
  getWarpContractTxId,
  log,
} = require('./common.js');
const {existsSync, mkdirSync} = require('fs');

const getWarpCacheOptions = (cachePath) => {
  return {
    ...defaultCacheOptions,
    dbLocation: path.join(cachePath, defaultCacheOptions.dbLocation),
  };
};

const getWarp = (destPath, logLevel) => {
  // set warp log level to none
  LoggerFactory.INST.logLevel(logLevel ? logLevel : 'none');
  const options = destPath
    ? getWarpCacheOptions(destPath)
    : {...defaultCacheOptions, inMemory: true};
  return WarpFactory.forTestnet({...options});
};

async function getRepoFromPL(repoUrl) {
  const id = `${repoUrl.replace(/.*:\/\//, '')}`;
  const gitdir = '.git';
  const destpath = getTmpPath(gitdir);
  const pl = getWarp(destpath).contract(getWarpContractTxId());
  // let warp throw error if it can't retrieve the repository
  const response = await pl.viewState({
    function: 'getRepository',
    payload: {
      id,
    },
  });
  return response.result;
}

function getTmpPath(gitdir) {
  const tmpPath = path.join(gitdir, PL_TMP_PATH);

  // Check if the tmp folder exists, and create it if it doesn't
  if (!existsSync(tmpPath)) {
    mkdirSync(tmpPath, {recursive: true});
    if (!existsSync(tmpPath)) {
      throw new Error(`Failed to create the directory: ${tmpPath}`);
    }
  }
  return tmpPath;
}

async function updateDeploymentBranch(repo, deploymentBranch) {
  if (!repo.id) {
    throw '[ warp ] No id to update repo ';
  }

  const payload = {
    id: repo.id,
    deploymentBranch,
  };

  // let warp throw error if it can't perform the writeInteraction
  const contract = getWarp().contract(getWarpContractTxId());
  await contract.connect(getWallet()).writeInteraction({
    function: 'updateRepositoryDetails',
    payload,
  });
}

async function addDeployment(repo, deployment) {
  if (!repo.id) {
    throw '[ warp ] No id to update repo ';
  }

  const payload = {
    id: repo.id,
    deployment,
  };

  // let warp throw error if it can't perform the writeInteraction
  const contract = getWarp().contract(getWarpContractTxId());
  await contract.connect(getWallet()).writeInteraction({
    function: 'addDeployment',
    payload,
  });

  log(`Deployment Link: https://ar-io.net/${deployment.txId}\n`, {
    color: 'green',
  });
}

exports.addDeployment = addDeployment;
exports.updateDeploymentBranch = updateDeploymentBranch;
exports.getRepoFromPL = getRepoFromPL;
exports.getWarpCacheOptions = getWarpCacheOptions;
