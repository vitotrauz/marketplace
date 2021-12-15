import { parseUnits } from '@ethersproject/units'
import { Bid, Network } from '@dcl/schemas'
import {
  ContractData,
  ContractName,
  getContract
} from 'decentraland-transactions'
import { Wallet } from 'decentraland-dapps/dist/modules/wallet/types'
import { sendTransaction } from 'decentraland-dapps/dist/modules/wallet/utils'
import { NFT } from '../../nft/types'
import { OrderStatus } from '../../order/types'
import { VendorName } from '../types'
import { BidService as BidServiceInterface } from '../services'
import { bidAPI } from './bid/api'
import { getERC721ContractData } from './utils'

export class BidService
  implements BidServiceInterface<VendorName.DECENTRALAND> {
  async fetchBySeller(seller: string) {
    const bids = await bidAPI.fetchBySeller(seller)
    return bids
  }

  async fetchByBidder(bidder: string) {
    const bids = await bidAPI.fetchByBidder(bidder)
    return bids
  }

  async fetchByNFT(nft: NFT, status: OrderStatus = OrderStatus.OPEN) {
    const bids = await bidAPI.fetchByNFT(
      nft.contractAddress,
      nft.tokenId,
      status
    )
    return bids
  }

  async place(
    wallet: Wallet | null,
    nft: NFT,
    price: number,
    expiresAt: number,
    fingerprint?: string
  ) {
    if (!wallet) {
      throw new Error('Invalid address. Wallet must be connected.')
    }

    const priceInWei = parseUnits(price.toString(), 'ether')
    const expiresIn = Math.round((expiresAt - Date.now()) / 1000)

    console.log(priceInWei, priceInWei.toString())

    switch (nft.network) {
      case Network.ETHEREUM: {
        const contract: ContractData = getContract(
          ContractName.Bid,
          nft.chainId
        )
        return sendTransaction(contract, bid => {
          if (fingerprint) {
            return bid['placeBid(address,uint256,uint256,uint256,bytes)'](
              nft.contractAddress,
              nft.tokenId,
              priceInWei,
              expiresIn,
              fingerprint
            )
          } else {
            return bid['placeBid(address,uint256,uint256,uint256)'](
              nft.contractAddress,
              nft.tokenId,
              priceInWei,
              expiresIn
            )
          }
        })
      }
      case Network.MATIC: {
        const contract: ContractData = getContract(
          ContractName.BidV2,
          nft.chainId
        )
        return sendTransaction(contract, bids =>
          bids['placeBid(address,uint256,uint256,uint256)'](
            nft.contractAddress,
            nft.tokenId,
            priceInWei,
            expiresIn
          )
        )
      }
    }
  }

  async accept(wallet: Wallet | null, bid: Bid) {
    if (!wallet) {
      throw new Error('Invalid address. Wallet must be connected.')
    }

    const contract: ContractData = getERC721ContractData(bid)

    return sendTransaction(contract, erc721 =>
      erc721.transferFrom(wallet.address, bid.bidAddress, bid.tokenId)
    )
  }

  async cancel(wallet: Wallet | null, bid: Bid) {
    if (!wallet) {
      throw new Error('Invalid address. Wallet must be connected.')
    }

    const contract: ContractData =
      bid.network === Network.ETHEREUM
        ? getContract(ContractName.Bid, bid.chainId)
        : getContract(ContractName.BidV2, bid.chainId)

    return sendTransaction(contract, bids =>
      bids.cancelBid(bid.contractAddress, bid.tokenId)
    )
  }
}
