import { Lottery } from './src/contracts/lottery'
import {
    bsv,
    TestWallet,
    DefaultProvider,
    toByteString,
    FixedArray,
    PubKey,
    sha256,
    int2ByteString,
    findSig,
    MethodCallOptions,
} from 'scrypt-ts'
import { randomPrivateKey, getDefaultSigner } from './tests/utils/txHelper'
import * as dotenv from 'dotenv'
import { randomBytes } from 'crypto'

// Load the .env file
dotenv.config()

// Read the private key from the .env file.
// The default private key inside the .env file is meant to be used for the Bitcoin testnet.
// See https://scrypt.io/docs/bitcoin-basics/bsv/#private-keys
// const privateKey = bsv.PrivateKey.fromWIF(process.env.PRIVATE_KEY || '')
// const [ownerPrivKey, ownerPubKey, ,] = randomPrivateKey()
// const [player1PrivKey, player1PubKey, ,] = randomPrivateKey()
// const [player2PrivKey, player2PubKey, ,] = randomPrivateKey()
let owner: bsv.PrivateKey = bsv.PrivateKey.fromWIF('L12nzYZNo1k1TwSWzkwT899kpSyAwtSEMfXxaM9P3znw3RAnamcw');
let player1: bsv.PrivateKey = bsv.PrivateKey.fromWIF('L4pXiHEfG2B3byWenBWqDDGozv6EZoxNrLnGavDFg6Jd3fomjZYR');
let player2: bsv.PrivateKey = bsv.PrivateKey.fromWIF('L219Rmzqe9JuuN1xx7eHxHXB6KaeBn789tYwJzf6njX6wHQQpUBG');

// Prepare signer.
// See https://scrypt.io/docs/how-to-deploy-and-call-a-contract/#prepare-a-signer-and-provider
const signer = getDefaultSigner(owner)

function generateRandomNonce(): bigint {
    const randomData = randomBytes(32)
    return BigInt('0x' + randomData.toString('hex'))
}

async function main() {
    await Lottery.loadArtifact()

    let instance: Lottery

    let nonce1: bigint = generateRandomNonce()
    let nonce2: bigint = generateRandomNonce()

    instance = new Lottery(
        PubKey(owner.publicKey.toString()),
        [PubKey(player1.publicKey.toString()), PubKey(player2.publicKey.toString())],
        [sha256(int2ByteString(nonce1)), sha256(int2ByteString(nonce2))]
    )

    console.log(await signer.getBalance())

    // Connect to a signer.
    await instance.connect(signer)

    // Contract deployment.
    const amount = 1
    const deployTx = await instance.deploy(amount)
    console.log('Lottery contract deployed: ', deployTx.id)

    const newInstance = Lottery.fromTx(deployTx, 0)
    await newInstance.connect(signer)

    const nextInstance = newInstance.next()
    nextInstance.totalAmount = 10n

    const { tx: fundTx, next } = await newInstance.methods.fund(
        (sigReps) => findSig(sigReps, owner.publicKey),
        10n,
        {
            pubKeyOrAddrToSign: owner.publicKey,
            next: {
                instance: nextInstance,
                balance: Number(nextInstance.totalAmount),
            },
        } as MethodCallOptions<Lottery>
    )

    console.log('Fund tx: ', fundTx.id)

    const latestInstance = Lottery.fromTx(fundTx, 0)
    await latestInstance.connect(signer)
    latestInstance.bindTxBuilder('draw', Lottery.drawTxBuilder)
    const next2Instance = newInstance.next()
    latestInstance.totalAmount = 10n
    const nonce: FixedArray<bigint, 2> = [nonce1, nonce2]
    const { tx: drawTx, next: next2 } = await latestInstance.methods.draw(
        nonce,
        (sigReps) => findSig(sigReps, owner.publicKey),
        {
            pubKeyOrAddrToSign: owner.publicKey,
            next: {
                instance: next2Instance,
                balance: latestInstance.balance,
            },
        } as MethodCallOptions<Lottery>
    )
    console.log('Draw tx: ', drawTx.id)
}
main()
