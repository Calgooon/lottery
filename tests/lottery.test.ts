import { expect, use } from 'chai'
import { sha256, toByteString, hash256, Sig, Signer } from 'scrypt-ts'
import { Lottery } from '../src/contracts/lottery'
import { getDefaultSigner } from './utils/txHelper'
import chaiAsPromised from 'chai-as-promised'
import { PubKey, bsv } from 'scrypt-ts'
use(chaiAsPromised)

describe('Test SmartContract `Lottery`', () => {
    let instance: Lottery 
    let signer: Signer;
    let owner: bsv.PrivateKey = bsv.PrivateKey.fromWIF('L12nzYZNo1k1TwSWzkwT899kpSyAwtSEMfXxaM9P3znw3RAnamcw');
    let player1: bsv.PrivateKey = bsv.PrivateKey.fromWIF('L4pXiHEfG2B3byWenBWqDDGozv6EZoxNrLnGavDFg6Jd3fomjZYR');
    let player2: bsv.PrivateKey = bsv.PrivateKey.fromWIF('L219Rmzqe9JuuN1xx7eHxHXB6KaeBn789tYwJzf6njX6wHQQpUBG');

    before(async () => {
        await Lottery.loadArtifact()

        instance = new Lottery(
            PubKey(owner.publicKey.toString())
        );

        // Connect to the signer
        signer = getDefaultSigner();
        await instance.connect(signer);

        // Deploy the contract with a small amount of satoshis
        const deployTx = await instance.deploy(1000); // Increased to 1000 satoshis for safety
        console.log(`Deployed contract "Lottery": ${deployTx.id}`);

        const call = async () => {
            const callRes = await instance.methods.enter(
                PubKey(player1.publicKey.toString()),
                Sig()
            )
            
            console.log(`Called "unlock" method: ${callRes.tx.id}`)
        }
    })

    it('should pass the public method unit test successfully.', async () => {
        const deployTx = await instance.deploy(1)
        console.log(`Deployed contract "Lottery": ${deployTx.id}`)

        const call = async () => {
            const callRes = await instance.methods.unlock(
                toByteString('hello world', true)
            )
            
            console.log(`Called "unlock" method: ${callRes.tx.id}`)
        }
        await expect(call()).not.to.be.rejected
    })


    describe('enter method', () => {
        it('should allow player1 to enter with sufficient fee', async () => {
            const bsvtx = new bsv.Transaction();
            bsvtx.from({
                txId: instance.utxo.txId,
                outputIndex: instance.utxo.outputIndex,
                script: instance.lockingScript.toHex(),
                satoshis: Number(Lottery.ENTRY_FEE) // Use contract's ENTRY_FEE constant
            });
            
            // ... signature generation remains same ...
    
            const playerPubKey = PubKey(player1.publicKey.toString());
            const call = async () => {
                const callRes = await instance.methods.enter(
                    playerPubKey,
                    Sig(signature.toString()),
                    {
                        changeAddress: await signer.getDefaultAddress(),
                        satoshis: Lottery.ENTRY_FEE,
                    }
                );
                return callRes; // Return for better testing
            };
    
            const result = await expect(call()).not.to.be.rejected;
            expect(instance.totalEntries).to.equal(1);
            expect(instance.players[0]).to.equal(playerPubKey);
        });

        // it('should throw with wrong message.', async () => {
        //     await instance.deploy(1)
        //     const call = async () => instance.methods.unlock(toByteString('wrong message', true))
        //     await expect(call()).to.be.rejectedWith(/Hash does not match/)
        // });
    });
});