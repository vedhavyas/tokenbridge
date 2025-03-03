#!/usr/bin/env bash
cd $(dirname $0)
set -e # exit when any command fails

CONTRACTS_PATH="../../contracts"
DEPLOY_PATH="$CONTRACTS_PATH/deploy"
ENVS_PATH="../contracts-envs"

echo -e "\n\n############ Deploying native-to-erc ############\n"
cp "$ENVS_PATH/native-to-erc.env" "$DEPLOY_PATH/.env"
cd "$DEPLOY_PATH"
node deploy.js
cd - > /dev/null

echo -e "\n\n############ Deploying erc20 and erc-to-erc ############\n"
node deployERC20.js
cp "$ENVS_PATH/erc-to-erc.env" "$DEPLOY_PATH/.env"
cd "$DEPLOY_PATH"
node deploy.js
cd - > /dev/null

echo -e "\n\n############ Deploying block reward ############\n"
cd "$DEPLOY_PATH"
node src/utils/deployBlockReward.js
cd - > /dev/null

echo -e "\n\n############ Deploying erc-to-native ############\n"
cp "$ENVS_PATH/erc-to-native.env" "$DEPLOY_PATH/.env"
cd "$DEPLOY_PATH"
node deploy.js
cd - > /dev/null
