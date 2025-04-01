import { Lottery } from './src/contracts/lottery'
import {
    TestWallet,
    DefaultProvider,
} from 'scrypt-ts'

import { expect, use } from 'chai'
import {
    sha256, toByteString, hash256, Sig, Signer, findSig,
    HashedMap, Sha256,
    int2ByteString
} from 'scrypt-ts'
import chaiAsPromised from 'chai-as-promised'
import { PubKey, bsv, MethodCallOptions } from 'scrypt-ts'
import crypto from 'crypto'

import * as dotenv from 'dotenv'
import Address = bsv.Address

// Load the .env file
dotenv.config()

if (!process.env.PRIVATE_KEY) {
    throw new Error("No \"PRIVATE_KEY\" found in .env, Please run \"npm run genprivkey\" to generate a private key")
}

// Read the private key from the .env file.
// The default private key inside the .env file is meant to be used for the Bitcoin testnet.
// See https://scrypt.io/docs/bitcoin-basics/bsv/#private-keys
const privateKey = bsv.PrivateKey.fromWIF(process.env.PRIVATE_KEY || '')

// Prepare signer.
// See https://scrypt.io/docs/how-to-deploy-and-call-a-contract/#prepare-a-signer-and-provider
const signer = new TestWallet(
    privateKey,
    new DefaultProvider({
        network: bsv.Networks.mainnet,
    })
)

// Helper function to generate random SHA256 nonce
function generateRandomNonce(): bigint {
    const randomBytes = crypto.randomBytes(32);
    return BigInt('0x' + randomBytes.toString('hex'));
}

// Helper function to find outputs that sum to at least 25 satoshis
function findOutputsToSum(outputs: any[], target: number = 25): any {
    for (const output of outputs) {
        if (output.satoshis >= target)
            return output
    }

    return { satoshis: 0 };
}

async function main() {
    await Lottery.loadArtifact()

    // TODO: Adjust the amount of satoshis locked in the smart contract:
    const amount = 1

    let instance: Lottery
    let owner: bsv.PrivateKey = bsv.PrivateKey.fromWIF('L12nzYZNo1k1TwSWzkwT899kpSyAwtSEMfXxaM9P3znw3RAnamcw');
    let player1: bsv.PrivateKey = bsv.PrivateKey.fromWIF('L4pXiHEfG2B3byWenBWqDDGozv6EZoxNrLnGavDFg6Jd3fomjZYR');
    let player2: bsv.PrivateKey = bsv.PrivateKey.fromWIF('L219Rmzqe9JuuN1xx7eHxHXB6KaeBn789tYwJzf6njX6wHQQpUBG');
    let nonce1: bigint = generateRandomNonce()
    let nonce2: bigint = generateRandomNonce()



    instance = new Lottery(
        PubKey(owner.publicKey.toString()),
        [PubKey(player1.publicKey.toString()), PubKey(player2.publicKey.toString())],
        [sha256(int2ByteString(nonce1)), sha256(int2ByteString(nonce2))]
    );

    // instance.bindTxBuilder('fund', Lottery.fundTxBuilder)
    // Connect to a signer.
    await instance.connect(signer)

    // Contract deployment.
    const deployTx = await instance.deploy(amount)
    console.log(`Lottery contract deployed: ${deployTx.id}`)


    const newInstance = Lottery.fromTx(deployTx, 0)
    await newInstance.connect(signer)

    const nextInstance = newInstance.next()
    // call the method of current instance to apply the updates on chain
    const { tx: fundTx, next } = await newInstance.methods.fund(
        (sigReps) => findSig(sigReps, owner.publicKey),
        {
            next: {
                instance: nextInstance,
                balance: newInstance.balance
            }
        } as MethodCallOptions<Lottery>
    );



    // console.log(await signer.getBalance())
    // var unspents = await signer.listUnspent(Address.fromString(signer.addresses[0]))
    // var fundingTx = findOutputsToSum(unspents, 25)
    // if (fundingTx.satoshis == 0) {
    //     throw new Error("No funding tx found")
    // }
    // console.log(fundingTx)

    // contract call `bid` one
    // const { tx: fundTx, next } = await instance.methods.fund(
    //     (sigReps) => findSig(sigReps, owner.publicKey),
    //     // ,
    //     {
    //         changeAddress: Address.fromString(signer.addresses[0]),
    //         // fromUTXO: {
    //         //     txId: deployTx.id,
    //         //     outputIndex: 0,
    //         //     satoshis: deployTx.outputs[0].satoshis,
    //         //     script: deployTx.outputs[0].script.toHex()
    //         // }
    //     } as MethodCallOptions<Lottery>
    // )
    console.log('Fund Tx: ', fundTx.id)
}

main()
function getDefaultSigner() {
    throw new Error('Function not implemented.')
}

