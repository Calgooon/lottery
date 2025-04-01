import { expect, use } from 'chai'
import { sha256, toByteString, hash256, Sig, Signer, findSig, 
    HashedMap, Sha256, 
    int2ByteString} from 'scrypt-ts'
import { Lottery } from '../src/contracts/lottery'
import { getDefaultSigner } from './utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
import { PubKey, bsv, MethodCallOptions } from 'scrypt-ts'
import crypto from 'crypto'
use(chaiAsPromised)

// Helper function to generate random SHA256 nonce
function generateRandomNonce(): bigint {
    const randomBytes = crypto.randomBytes(32);
    return BigInt('0x' + randomBytes.toString('hex'));
}
// Helper function to find outputs that sum to at least 25 satoshis
function findOutputsToSum(outputs: any[], target: number = 25): any[] {
    let sum = 0;
    const result: any[] = [];
    
    for (const output of outputs) {
        sum += output.satoshis;
        result.push(output);
        if (sum >= target) break;
    }
    
    return result;
}

describe('Test SmartContract `Lottery`', () => {
    let instance: Lottery 
    let signer: Signer;
    let owner: bsv.PrivateKey = bsv.PrivateKey.fromWIF('L12nzYZNo1k1TwSWzkwT899kpSyAwtSEMfXxaM9P3znw3RAnamcw');
    let player1: bsv.PrivateKey = bsv.PrivateKey.fromWIF('L4pXiHEfG2B3byWenBWqDDGozv6EZoxNrLnGavDFg6Jd3fomjZYR');
    let player2: bsv.PrivateKey = bsv.PrivateKey.fromWIF('L219Rmzqe9JuuN1xx7eHxHXB6KaeBn789tYwJzf6njX6wHQQpUBG');
    let nonce1: bigint = generateRandomNonce()
    let nonce2: bigint = generateRandomNonce()
    before(async () => {
        await Lottery.compile()

        instance = new Lottery(
            PubKey(owner.publicKey.toString()),
            [PubKey(player1.publicKey.toString()), PubKey(player2.publicKey.toString())],
            [sha256(int2ByteString(nonce1)), sha256(int2ByteString(nonce2))]
        );

        // Connect to the signer
        signer = getDefaultSigner();
        await instance.connect(signer);

        // Deploy the contract with a small amount of satoshis
        const deployTx = await instance.deploy(1);
        console.log(`Deployed contract "Lottery": ${deployTx.id}`);
        console.log(signer.listUnspent(await signer.getDefaultAddress()))

        const call = async () => {
            const callRes = await instance.methods.fund(
                (sigResps) => findSig(sigResps, owner.publicKey),
                {
                    pubKeyOrAddrToSign: owner.publicKey,
                } as MethodCallOptions<Lottery>
            )
            
            console.log(`Called "enter" method: ${callRes.tx.id}`)
        }
        await expect(call()).to.be.not.rejected
    })
});