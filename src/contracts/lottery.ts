import {
    assert,
    method,
    prop,
    Sha256,
    hash160,
    SmartContract,
    PubKey,
    Sig,
    hash256,
    Utils,
    ByteString,
    sha256,
    FixedArray,
    int2ByteString,
    bsv,
    ContractTransaction,
    MethodCallOptions,
    UTXO,
    pubKey2Addr,
} from 'scrypt-ts'
import Transaction = bsv.Transaction
import Script = bsv.Script
import Address = bsv.Address

export class Lottery extends SmartContract {
    @prop()
    owner: PubKey // Contract owner

    @prop(true)
    participants: FixedArray<PubKey, 2> // List of participant public keys

    @prop(true)
    nonceHashes: FixedArray<Sha256, 2> // List of nonce hashes

    @prop(true)
    totalAmount: bigint // Track total amount from all participants

    @prop(true)
    isOver: boolean // Track if lottery has been drawn

    // Generate a random SHA256 nonce
    @method()
    static generateNonce(randomBytes: ByteString): Sha256 {
        return sha256(randomBytes)
    }

    constructor(
        owner: PubKey,
        participants: FixedArray<PubKey, 2>,
        nonceHashes: FixedArray<Sha256, 2>
    ) {
        super(...arguments)
        this.owner = owner
        this.participants = participants
        this.nonceHashes = nonceHashes
        this.totalAmount = 0n
        this.isOver = false
    }

    @method()
    public fund(sig: Sig, amount: bigint) {
        assert(!this.isOver, 'Lottery has already been drawn')
        // Only the owner can add a participant
        assert(
            this.checkSig(sig, this.owner),
            'Only the owner can enter participants'
        )
        // console.log(this.ctx.hashOutputs)
        // console.log(this.ctx.hashPrevouts)
        // console.log(this.ctx)
        // // Verify entry fee
        // assert(this.ctx.utxo.value == 10n, 'Incorrect entry fee');

        this.totalAmount = 10n

        let output: ByteString =
            this.buildStateOutput(this.totalAmount) + this.buildChangeOutput()
        // const hashOutputs = hash256(output)
        // console.log(hashOutputs)
        // c output = this.buildStateOutput(1n) + this.buildChangeOutput()
        // const hashOutputs2 = hash256(output2)
        // console.log(hashOutputs2)
        assert(
            this.ctx.hashOutputs === hash256(output),
            'New utxo must have enough to pay winner'
        )
        // assert(true)
    }

    @method()
    public draw(nonce: FixedArray<bigint, 2>, sig: Sig) {
        // Only owner can draw the winner
        assert(this.checkSig(sig, this.owner), 'Only the owner can draw')
        assert(!this.isOver, 'Lottery has already been drawn')
        assert(this.totalAmount > 0n, 'No satoshis in lottery')

        this.isOver = true

        let sum = 0n

        for (let i = 0; i < 2; i++) {
            assert(hash256(int2ByteString(nonce[i])) == this.nonceHashes[i])

            sum += nonce[i]
        }

        const winner: PubKey = this.participants[Number(sum % BigInt(2))]

        // Transfer funds to winner
        const outputs =
            Utils.buildPublicKeyHashOutput(
                pubKey2Addr(winner),
                this.totalAmount
            ) + this.buildChangeOutput()
        assert(this.ctx.hashOutputs == hash256(outputs), 'Output mismatch')
    }

    // User defined transaction builder for calling function `bid`
    static fundTxBuilder(
        current: Lottery,
        options: MethodCallOptions<Lottery>,
        amount: bigint
    ): Promise<ContractTransaction> {
        const nextInstance = current.next()
        // console.log(options.fromUTXO)

        const unsignedTx: Transaction = new Transaction()
            // add contract input
            .addInput(current.buildContractInput())
            // build next instance output
            .addOutput(
                new Transaction.Output({
                    script: nextInstance.lockingScript,
                    satoshis: Number(current.balance),
                })
            )
        // .change(options.changeAddress)
        // // build refund output
        // .addOutput(
        //     new Transaction.Output({
        //         script: Script.fromHex(
        //             Utils.buildPublicKeyHashScript(hash160(current.owner))
        //         ),
        //         satoshis: current.balance,
        //     })
        // )
        // build change output// build change output
        // if (options.changeAddress) {
        //     // build change output
        //     unsignedTx.change(options.changeAddress)
        // }

        // console.log(unsignedTx)

        return Promise.resolve({
            tx: unsignedTx,
            atInputIndex: 0,
            nexts: [
                {
                    instance: nextInstance,
                    atOutputIndex: 0,
                    balance: Number(nextInstance.balance),
                },
            ],
        })
    }

    static async drawTxBuilder(
        current: Lottery,
        options: MethodCallOptions<Lottery>,
        nonce: FixedArray<bigint, 2>
    ): Promise<ContractTransaction> {
        let sum = 0n

        for (let i = 0; i < 2; i++) {
            assert(hash256(int2ByteString(nonce[i])) == current.nonceHashes[i])

            sum += nonce[i]
        }
        const winner: PubKey = current.participants[Number(sum % BigInt(2))]
        const defaultChangeAddress = await current.signer.getDefaultAddress()
        const unsignedTx: bsv.Transaction = new bsv.Transaction()
            // add contract input
            .addInput(current.buildContractInput(options.fromUTXO))

            // build winner output
            .addOutput(
                new bsv.Transaction.Output({
                    script: bsv.Script.fromHex(
                        Utils.buildPublicKeyHashScript(pubKey2Addr(winner))
                    ),
                    satoshis: Number(current.totalAmount),
                })
            )
            // build change output
            .change(options.changeAddress || defaultChangeAddress)

        return Promise.resolve({
            tx: unsignedTx,
            atInputIndex: 0,
            nexts: [],
        })
    }
}
