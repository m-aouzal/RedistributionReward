console.clear();
require("dotenv").config();
const {
  AccountId,
  PrivateKey,
  Client,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  Hbar,
  ContractFunctionResult,
} = require("@hashgraph/sdk");
const axios = require("axios");

const baseUrl = "https://testnet.mirrornode.hedera.com/api/v1";
const contractId = process.env.REWARD_DISTRIBUTION_CONTRACT_ID;

async function queryMirrorNodeFor(url) {
  const response = await axios.get(url);
  return response.data;
}

async function getTokenBalance(accountId, tokenId) {
  const url = `${baseUrl}/balances?account.id=${accountId}`;
  const balanceInfo = await queryMirrorNodeFor(url);

  if (balanceInfo && balanceInfo.balances) {
    for (const item of balanceInfo.balances) {
      if (item.account === accountId) {
        for (const token of item.tokens) {
          if (token.token_id === tokenId) {
            const tokenInfoUrl = `${baseUrl}/tokens/${tokenId}`;
            const tokenInfo = await queryMirrorNodeFor(tokenInfoUrl);

            if (tokenInfo && tokenInfo.decimals !== undefined) {
              const decimals = parseFloat(tokenInfo.decimals);
              const balance = token.balance / 10 ** decimals;
              return balance * 10000; // Adjust as necessary
            }
          }
        }
      }
    }
  }
  return null;
}

async function getStakesAndRewards(client, contractId, account) {
  const stakesQuery = new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(3000000)
    .setFunction(
      "getStakes",
      new ContractFunctionParameters().addAddress(account)
    );
  const stakesTransactionId = await stakesQuery.execute(client);
  const stakesRecord = await stakesTransactionId.getRecord(client);
  const stakesContractFunctionResult = stakesRecord.contractFunctionResult;
  const stakes = stakesContractFunctionResult.getUint64(0).toString();

  const rewardsQuery = new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(3000000)
    .setFunction(
      "getRewards",
      new ContractFunctionParameters().addAddress(account)
    );
  const rewardsTransactionId = await rewardsQuery.execute(client);
  const rewardsRecord = await rewardsTransactionId.getRecord(client);
  const rewardsContractFunctionResult = rewardsRecord.contractFunctionResult;
  const rewards = rewardsContractFunctionResult.getUint64(0).toString();

  return { stakes, rewards };
}

async function claimRewards(client) {
  const claimRewardsTx = await new ContractExecuteTransaction()
    .setContractId(process.env.REWARD_DISTRIBUTION_CONTRACT_ID)
    .setGas(3000000)
    .setFunction("claimRewards")
    .setMaxTransactionFee(new Hbar(20));
  const claimRewardsSubmit = await claimRewardsTx.execute(client);
  const claimRewardsReceipt = await claimRewardsSubmit.getReceipt(client);
  console.log(`- Rewards claimed: ${claimRewardsReceipt.status.toString()}`);
}

async function main() {
  const operatorId = AccountId.fromString(process.env.ACCOUNT_ID);
  const operatorKey = PrivateKey.fromStringECDSA(
    process.env.ACCOUNT_PRIVATE_KEY
  );
  const account1Id = AccountId.fromString(process.env.ACCOUNT1_ID);
  const account1Key = PrivateKey.fromStringECDSA(
    process.env.ACCOUNT1_PRIVATE_KEY
  );
  const account2Id = AccountId.fromString(process.env.ACCOUNT2_ID);
  const account2Key = PrivateKey.fromStringECDSA(
    process.env.ACCOUNT2_PRIVATE_KEY
  );
  const account3Id = AccountId.fromString(process.env.ACCOUNT3_ID);
  const account3Key = PrivateKey.fromStringECDSA(
    process.env.ACCOUNT3_PRIVATE_KEY
  );
  const contractId = process.env.REWARD_DISTRIBUTION_CONTRACT_ID;

  const client = Client.forTestnet().setOperator(operatorId, operatorKey);
  const client1 = Client.forTestnet().setOperator(account1Id, account1Key);
  const client2 = Client.forTestnet().setOperator(account2Id, account2Key);
  const client3 = Client.forTestnet().setOperator(account3Id, account3Key);

  try {
    // Log initial balances
    console.log("Balances at the beginning:");
    console.log(
      `Account 1 MST: ${await getTokenBalance(
        process.env.ACCOUNT1_ID,
        process.env.MST_TOKEN_ADDRESS
      )}`
    );
    console.log(
      `Account 1 MPT: ${await getTokenBalance(
        process.env.ACCOUNT1_ID,
        process.env.MPT_TOKEN_ADDRESS
      )}`
    );
    console.log(
      `Account 2 MST: ${await getTokenBalance(
        process.env.ACCOUNT2_ID,
        process.env.MST_TOKEN_ADDRESS
      )}`
    );
    console.log(
      `Account 2 MPT: ${await getTokenBalance(
        process.env.ACCOUNT2_ID,
        process.env.MPT_TOKEN_ADDRESS
      )}`
    );
    console.log(
      `Account 3 MST: ${await getTokenBalance(
        process.env.ACCOUNT3_ID,
        process.env.MST_TOKEN_ADDRESS
      )}`
    );
    console.log(
      `Account 3 MPT: ${await getTokenBalance(
        process.env.ACCOUNT3_ID,
        process.env.MPT_TOKEN_ADDRESS
      )}`
    );

    // Check initial stakes and rewards
    console.log("Initial stakes and rewards:");
    console.log(
      "Account 1:",
      await getStakesAndRewards(
        client1,
        contractId,
        process.env.ACCOUNT1_ADDRESS_ETHER
      )
    );
    console.log(
      "Account 2:",
      await getStakesAndRewards(
        client2,
        contractId,
        process.env.ACCOUNT2_ADDRESS_ETHER
      )
    );
    console.log(
      "Account 3:",
      await getStakesAndRewards(
        client3,
        contractId,
        process.env.ACCOUNT3_ADDRESS_ETHER
      )
    );

    // Step 1: Account 1 stakes 4000 MST
    console.log("Account 1 staking 4000 MST...");
    try {
      const stakeTx1 = await new ContractExecuteTransaction()
        .setContractId(contractId)
        .setGas(3000000)
        .setFunction(
          "stakeTokens",
          new ContractFunctionParameters().addUint64(4000)
        )
        .setMaxTransactionFee(new Hbar(20));
      const stakeTxSubmit1 = await stakeTx1.execute(client1);
      const stakeTxReceipt1 = await stakeTxSubmit1.getReceipt(client1);
      console.log(
        `- Tokens staked by Account 1 using stakeTokens function: ${stakeTxReceipt1.status.toString()}`
      );
    } catch (error) {
      console.error(
        "Error during staking of 4000 MST by Account 1 using stakeTokens function:",
        error
      );
    }

    console.log("Balances after staking:");
    console.log(
      `Account 1 MST: ${await getTokenBalance(
        process.env.ACCOUNT1_ID,
        process.env.MST_TOKEN_ADDRESS
      )}`
    );
    console.log(
      `Account 1 MPT: ${await getTokenBalance(
        process.env.ACCOUNT1_ID,
        process.env.MPT_TOKEN_ADDRESS
      )}`
    );

    // Step 2: Account 2 stakes 4000 MST and then sends 4000 MPT to Account 3
    console.log("Account 2 staking 4000 MST...");
    try {
      const stakeTx2 = await new ContractExecuteTransaction()
        .setContractId(contractId)
        .setGas(3000000)
        .setFunction(
          "stakeTokens",
          new ContractFunctionParameters().addUint64(4000)
        )
        .setMaxTransactionFee(new Hbar(20));
      const stakeTxSubmit2 = await stakeTx2.execute(client2);
      const stakeTxReceipt2 = await stakeTxSubmit2.getReceipt(client2);
      console.log(
        `- Tokens staked by Account 2 using stakeTokens function: ${stakeTxReceipt2.status.toString()}`
      );
    } catch (error) {
      console.error(
        "Error during staking of 4000 MST by Account 2 using stakeTokens function:",
        error
      );
    }

    console.log("Account 2 transferring 4000 MPT to Account 3...");
    try {
      const transferMptTx2 = await new ContractExecuteTransaction()
        .setContractId(contractId)
        .setGas(3000000)
        .setFunction(
          "transferMptTokens",
          new ContractFunctionParameters()
            .addUint64(4000)
            .addAddress(process.env.ACCOUNT3_ADDRESS_ETHER)
        )
        .setMaxTransactionFee(new Hbar(20));
      const transferMptTxSubmit2 = await transferMptTx2.execute(client2);
      const transferMptTxReceipt2 = await transferMptTxSubmit2.getReceipt(
        client2
      );
      console.log(
        `- Tokens transferred by Account 2 to Account 3 using transferMptTokens function: ${transferMptTxReceipt2.status.toString()}`
      );
    } catch (error) {
      console.error(
        "Error during transfer of 4000 MPT by Account 2 to Account 3 using transferMptTokens function:",
        error
      );
    }

    console.log("Balances after staking and transfer:");
    console.log(
      `Account 1 MST: ${await getTokenBalance(
        process.env.ACCOUNT1_ID,
        process.env.MST_TOKEN_ADDRESS
      )}`
    );
    console.log(
      `Account 1 MPT: ${await getTokenBalance(
        process.env.ACCOUNT1_ID,
        process.env.MPT_TOKEN_ADDRESS
      )}`
    );
    console.log(
      `Account 2 MST: ${await getTokenBalance(
        process.env.ACCOUNT2_ID,
        process.env.MST_TOKEN_ADDRESS
      )}`
    );
    console.log(
      `Account 2 MPT: ${await getTokenBalance(
        process.env.ACCOUNT2_ID,
        process.env.MPT_TOKEN_ADDRESS
      )}`
    );
    console.log(
      `Account 3 MST: ${await getTokenBalance(
        process.env.ACCOUNT3_ID,
        process.env.MST_TOKEN_ADDRESS
      )}`
    );
    console.log(
      `Account 3 MPT: ${await getTokenBalance(
        process.env.ACCOUNT3_ID,
        process.env.MPT_TOKEN_ADDRESS
      )}`
    );

    // Step 3: Account 3 stakes 4000 MST and then sends 2000 MPT to Account 1 and 2000 MPT to Account 2
    console.log("Account 3 staking 4000 MST...");
    try {
      const stakeTx3 = await new ContractExecuteTransaction()
        .setContractId(contractId)
        .setGas(3000000)
        .setFunction(
          "stakeTokens",
          new ContractFunctionParameters().addUint64(4000)
        )
        .setMaxTransactionFee(new Hbar(20));
      const stakeTxSubmit3 = await stakeTx3.execute(client3);
      const stakeTxReceipt3 = await stakeTxSubmit3.getReceipt(client3);
      console.log(
        `- Tokens staked by Account 3 using stakeTokens function: ${stakeTxReceipt3.status.toString()}`
      );
    } catch (error) {
      console.error(
        "Error during staking of 4000 MST by Account 3 using stakeTokens function:",
        error
      );
    }

    console.log("Account 3 transferring 2000 MPT to Account 1...");
    try {
      const transferMptTx3 = await new ContractExecuteTransaction()
        .setContractId(contractId)
        .setGas(3000000)
        .setFunction(
          "transferMptTokens",
          new ContractFunctionParameters()
            .addUint64(2000)
            .addAddress(process.env.ACCOUNT1_ADDRESS_ETHER)
        )
        .setMaxTransactionFee(new Hbar(20));
      const transferMptTxSubmit3 = await transferMptTx3.execute(client3);
      const transferMptTxReceipt3 = await transferMptTxSubmit3.getReceipt(
        client3
      );
      console.log(
        `- Tokens transferred by Account 3 to Account 1 using transferMptTokens function: ${transferMptTxReceipt3.status.toString()}`
      );
    } catch (error) {
      console.error(
        "Error during transfer of 2000 MPT by Account 3 to Account 1 using transferMptTokens function:",
        error
      );
    }

    console.log("Account 3 transferring 2000 MPT to Account 2...");
    try {
      const transferMptTx4 = await new ContractExecuteTransaction()
        .setContractId(contractId)
        .setGas(3000000)
        .setFunction(
          "transferMptTokens",
          new ContractFunctionParameters()
            .addUint64(2000)
            .addAddress(process.env.ACCOUNT2_ADDRESS_ETHER)
        )
        .setMaxTransactionFee(new Hbar(20));
      const transferMptTxSubmit4 = await transferMptTx4.execute(client3);
      const transferMptTxReceipt4 = await transferMptTxSubmit4.getReceipt(
        client3
      );
      console.log(
        `- Tokens transferred by Account 3 to Account 2 using transferMptTokens function: ${transferMptTxReceipt4.status.toString()}`
      );
    } catch (error) {
      console.error(
        "Error during transfer of 2000 MPT by Account 3 to Account 2 using transferMptTokens function:",
        error
      );
    }

    console.log("Balances after staking and transfer:");
    console.log(
      `Account 1 MST: ${await getTokenBalance(
        process.env.ACCOUNT1_ID,
        process.env.MST_TOKEN_ADDRESS
      )}`
    );
    console.log(
      `Account 1 MPT: ${await getTokenBalance(
        process.env.ACCOUNT1_ID,
        process.env.MPT_TOKEN_ADDRESS
      )}`
    );
    console.log(
      `Account 2 MST: ${await getTokenBalance(
        process.env.ACCOUNT2_ID,
        process.env.MST_TOKEN_ADDRESS
      )}`
    );
    console.log(
      `Account 2 MPT: ${await getTokenBalance(
        process.env.ACCOUNT2_ID,
        process.env.MPT_TOKEN_ADDRESS
      )}`
    );
    console.log(
      `Account 3 MST: ${await getTokenBalance(
        process.env.ACCOUNT3_ID,
        process.env.MST_TOKEN_ADDRESS
      )}`
    );
    console.log(
      `Account 3 MPT: ${await getTokenBalance(
        process.env.ACCOUNT3_ID,
        process.env.MPT_TOKEN_ADDRESS
      )}`
    );

    // Claim rewards before unstaking
    console.log(
      "Stakes and rewards before staking:",
      await getStakesAndRewards(
        client1,
        contractId,
        process.env.ACCOUNT1_ADDRESS_ETHER
      )
    );
    console.log("Claiming rewards for Account 1...");
    await claimRewards(client1);
    console.log(
      "Stakes and rewards for Account 1:",
      await getStakesAndRewards(
        client1,
        contractId,
        process.env.ACCOUNT1_ADDRESS_ETHER
      )
    );
    await claimRewards(client2);
    console.log(
      "Stakes and rewards for Account 2:",
      await getStakesAndRewards(
        client2,
        contractId,
        process.env.ACCOUNT2_ADDRESS_ETHER
      )
    );
    console.log("Claiming rewards for Account 2...");
    await claimRewards(client2);
    console.log(
      "Stakes and rewards for Account 2:",
      await getStakesAndRewards(
        client2,
        contractId,
        process.env.ACCOUNT2_ADDRESS_ETHER
      )
    );
await claimRewards(client3);
console.log(
  "Stakes and rewards for Account 3:",
  await getStakesAndRewards(
    client3,
    contractId,
    process.env.ACCOUNT3_ADDRESS_ETHER
  )
);
    console.log("Claiming rewards for Account 3...");
    await claimRewards(client3);
    console.log(
      "Stakes and rewards for Account 3:",
      await getStakesAndRewards(
        client3,
        contractId,
        process.env.ACCOUNT3_ADDRESS_ETHER
      )
    );

    // Step 4: Account 1 unstakes 4000 MST
    console.log("Account 1 unstaking 4000 MST...");
    try {
      const unstakeTx1 = await new ContractExecuteTransaction()
        .setContractId(contractId)
        .setGas(3000000)
        .setFunction(
          "unstakeTokens",
          new ContractFunctionParameters().addUint64(4000)
        )
        .setMaxTransactionFee(new Hbar(20));
      const unstakeTxSubmit1 = await unstakeTx1.execute(client1);
      const unstakeTxReceipt1 = await unstakeTxSubmit1.getReceipt(client1);
      console.log(
        `- Tokens unstaked by Account 1 using unstakeTokens function: ${unstakeTxReceipt1.status.toString()}`
      );
    } catch (error) {
      console.error(
        "Error during unstaking of 4000 MST by Account 1 using unstakeTokens function:",
        error
      );
    }

    console.log("Balances after unstaking:");
    console.log(
      `Account 1 MST: ${await getTokenBalance(
        process.env.ACCOUNT1_ID,
        process.env.MST_TOKEN_ADDRESS
      )}`
    );
    console.log(
      `Account 1 MPT: ${await getTokenBalance(
        process.env.ACCOUNT1_ID,
        process.env.MPT_TOKEN_ADDRESS
      )}`
    );

    // Step 5: Account 2 unstakes 4000 MST
    console.log("Account 2 unstaking 4000 MST...");
    try {
      const unstakeTx2 = await new ContractExecuteTransaction()
        .setContractId(contractId)
        .setGas(3000000)
        .setFunction(
          "unstakeTokens",
          new ContractFunctionParameters().addUint64(4000)
        )
        .setMaxTransactionFee(new Hbar(20));
      const unstakeTxSubmit2 = await unstakeTx2.execute(client2);
      const unstakeTxReceipt2 = await unstakeTxSubmit2.getReceipt(client2);
      console.log(
        `- Tokens unstaked by Account 2 using unstakeTokens function: ${unstakeTxReceipt2.status.toString()}`
      );
    } catch (error) {
      console.error(
        "Error during unstaking of 4000 MST by Account 2 using unstakeTokens function:",
        error
      );
    }

    console.log("Balances after unstaking:");
    console.log(
      `Account 2 MST: ${await getTokenBalance(
        process.env.ACCOUNT2_ID,
        process.env.MST_TOKEN_ADDRESS
      )}`
    );
    console.log(
      `Account 2 MPT: ${await getTokenBalance(
        process.env.ACCOUNT2_ID,
        process.env.MPT_TOKEN_ADDRESS
      )}`
    );

    // Step 6: Account 3 unstakes 4000 MST
    console.log("Account 3 unstaking 4000 MST...");
    try {
      const unstakeTx3 = await new ContractExecuteTransaction()
        .setContractId(contractId)
        .setGas(3000000)
        .setFunction(
          "unstakeTokens",
          new ContractFunctionParameters().addUint64(4000)
        )
        .setMaxTransactionFee(new Hbar(20));
      const unstakeTxSubmit3 = await unstakeTx3.execute(client3);
      const unstakeTxReceipt3 = await unstakeTxSubmit3.getReceipt(client3);
      console.log(
        `- Tokens unstaked by Account 3 using unstakeTokens function: ${unstakeTxReceipt3.status.toString()}`
      );
    } catch (error) {
      console.error(
        "Error during unstaking of 4000 MST by Account 3 using unstakeTokens function:",
        error
      );
    }

    console.log("Balances after unstaking:");
    console.log(
      `Account 3 MST: ${await getTokenBalance(
        process.env.ACCOUNT3_ID,
        process.env.MST_TOKEN_ADDRESS
      )}`
    );
    console.log(
      `Account 3 MPT: ${await getTokenBalance(
        process.env.ACCOUNT3_ID,
        process.env.MPT_TOKEN_ADDRESS
      )}`
    );

    console.log("All transactions executed successfully.");
  } catch (error) {
    console.error("Error during contract interaction:", error);
  }
}

main().catch(console.error);
