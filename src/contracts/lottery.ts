import {
    assert,
    ByteString,
    method,
    prop,
    sha256,
    Sha256,
    SmartContract,
    PubKey,
    Sig,
    hash256,
    Utils,
    SigHashPreimage,
    Ripemd160,
} from 'scrypt-ts';


export class Lottery extends SmartContract {
  
    @prop()
    owner: PubKey;  // Contract owner
  
    @prop(true)
    participants: PubKey[]; // List of participant public keys

    @prop(true)
    totalAmount: bigint; // Track total amount from all participants
  
    constructor(owner: PubKey) {
      super();
      this.owner = owner;
      this.participants = [];
      this.totalAmount = 0n;
    }
  
    @method()
    public enter(newParticipant: PubKey, sig: Sig) {
      // Only the owner can add a participant
      assert(this.checkSig(sig, this.owner), 'Only the owner can enter participants');
      
      // Verify entry fee
      assert(this.ctx.utxo.value >= 5n, 'Insufficient entry fee');
      
      this.participants.push(newParticipant);
      this.totalAmount += 5n;
    }
  
    @method()
    public draw(sig: Sig) {
      // Only owner can draw the winner
      assert(this.checkSig(sig, this.owner), 'Only the owner can draw');
  
      assert(this.participants.length > 0, 'No participants in lottery');
  
      // Simple randomness using transaction hash
      let randIndex = Number(hash256(this.ctx.utxo.script)) % this.participants.length;
      let winner = this.participants[randIndex];
  
      // Transfer funds to winner
      const outputs = Utils.buildOutput(
          Utils.buildPublicKeyHashScript(Ripemd160(winner)),
          this.totalAmount
      );
      assert(this.ctx.hashOutputs === hash256(outputs), 'Output mismatch');
    }
}