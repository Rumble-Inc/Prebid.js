import {_map, isArray} from '../src/utils.js';
import {registerBidder} from '../src/adapters/bidderFactory.js';
import {BANNER, VIDEO} from '../src/mediaTypes.js';
import { getCurrencyFromBidderRequest } from '../libraries/ortb2Utils/currency.js';
import {createRenderer, getMediaTypeFromBid, hasVideoMandatoryParams} from '../libraries/hybridVoxUtils/index.js';

/**
 * @typedef {import('../src/adapters/bidderFactory.js').BidRequest} BidRequest
 * @typedef {import('../src/adapters/bidderFactory.js').Bid} Bid
 * @typedef {import('../src/adapters/bidderFactory.js').ServerResponse} ServerResponse
 * @typedef {import('../src/adapters/bidderFactory.js').validBidRequests} validBidRequests
 */

const BIDDER_CODE = 'vox';
const SSP_ENDPOINT = 'https://ssp.hybrid.ai/auction/prebid';
const VIDEO_RENDERER_URL = 'https://acdn.adnxs.com/video/outstream/ANOutstreamVideo.js';
const TTL = 60;
const GVLID = 206;

function buildBidRequests(validBidRequests, bidderRequest) {
  return _map(validBidRequests, function(bid) {
    const currency = getCurrencyFromBidderRequest(bidderRequest);
    const floorInfo = bid.getFloor ? bid.getFloor({
      currency: currency || 'USD'
    }) : {};

    const params = bid.params;
    const bidRequest = {
      floorInfo,
      schain: bid?.ortb2?.source?.ext?.schain,
      userId: bid.userId,
      bidId: bid.bidId,
      // TODO: fix transactionId leak: https://github.com/prebid/Prebid.js/issues/9781
      transactionId: bid.transactionId,
      sizes: bid.sizes,
      placement: params.placement,
      placeId: params.placementId,
      imageUrl: params.imageUrl
    };

    return bidRequest;
  })
}

function buildBid(bidData) {
  const bid = {
    requestId: bidData.bidId,
    cpm: bidData.price,
    width: bidData.content.width,
    height: bidData.content.height,
    creativeId: bidData.content.seanceId || bidData.bidId,
    currency: bidData.currency,
    netRevenue: true,
    mediaType: BANNER,
    ttl: TTL,
    content: bidData.content,
    meta: {
      advertiserDomains: bidData.advertiserDomains || []}
  };

  if (bidData.placement === 'video') {
    bid.vastXml = bidData.content;
    bid.mediaType = VIDEO;
    const video = bidData.mediaTypes?.video;

    if (video) {
      bid.width = video.playerSize[0][0];
      bid.height = video.playerSize[0][1];

      if (video.context === 'outstream') {
        bid.renderer = createRenderer(bid, VIDEO_RENDERER_URL);
      }
    }
  } else if (bidData.placement === 'inImage') {
    bid.mediaType = BANNER;
    bid.ad = wrapInImageBanner(bid, bidData);
  } else {
    bid.mediaType = BANNER;
    bid.ad = wrapBanner(bid, bidData);
  }

  return bid;
}

function wrapInImageBanner(bid, bidData) {
  return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title></title>
        <script id="prebidrenderer"></script>
        <style>html, body {width: 100%; height: 100%; margin: 0;}</style>
    </head>
    <body>
      <div data-hyb-ssp-in-image-overlay="${bidData.content.placeId}" style="width: 100%; height: 100%;"></div>
      <script>
        var s = document.getElementById("prebidrenderer");
        s.onload = function () {
          var _html = "${encodeURIComponent(JSON.stringify(bid))}";
          window._hyb_prebid_ssp.registerInImage(JSON.parse(decodeURIComponent(_html)));
        }
        s.src = "https://st.hybrid.ai/prebidrenderer.js?t=" + Date.now();
        if (parent.window.frames[window.name]) {
            var parentDocument = window.parent.document.getElementById(parent.window.frames[window.name].name);
            parentDocument.style.height = "100%";
            parentDocument.style.width = "100%";
        }
      </script>
    </body>
  </html>`;
}

function wrapBanner(bid, bidData) {
  return `<!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title></title>
      <script id="prebidrenderer"></script>
      <style>html, body {width: 100%; height: 100%; margin: 0;}</style>
    </head>
    <body>
      <div data-hyb-ssp-ad-place="${bidData.content.placeId}"></div>
      <script>
        var s = document.getElementById("prebidrenderer");
        s.onload = function () {
            var _html = "${encodeURIComponent(JSON.stringify(bid))}";
            window._hyb_prebid_ssp.registerAds(JSON.parse(decodeURIComponent(_html)));
        }
        s.src = "https://st.hybrid.ai/prebidrenderer.js?t=" + Date.now();
      </script>
    </body>
  </html>`;
}

export const spec = {
  code: BIDDER_CODE,
  gvlid: GVLID,
  supportedMediaTypes: [BANNER, VIDEO],

  /**
   * Determines whether or not the given bid request is valid.
   *
   * @param {BidRequest} bid The bid params to validate.
   * @return boolean True if this is a valid bid, and false otherwise.
   */
  isBidRequestValid(bid) {
    return (
      !!bid.params.placementId &&
      !!bid.params.placement &&
      (
        (getMediaTypeFromBid(bid) === BANNER && bid.params.placement === 'banner') ||
        (getMediaTypeFromBid(bid) === BANNER && bid.params.placement === 'inImage' && !!bid.params.imageUrl) ||
        (getMediaTypeFromBid(bid) === VIDEO && bid.params.placement === 'video' && hasVideoMandatoryParams(bid.mediaTypes))
      )
    );
  },

  /**
   * Make a server request from the list of BidRequests.
   *
   * @param {BidRequest[]} validBidRequests - an array of bids
   * @param {Object} bidderRequest
   * @return {Object} Info describing the request to the server.
   */
  buildRequests(validBidRequests, bidderRequest) {
    const payload = {
      // TODO: is 'page' the right value here?
      url: bidderRequest.refererInfo.page,
      cmp: !!bidderRequest.gdprConsent,
      bidRequests: buildBidRequests(validBidRequests, bidderRequest)
    };

    if (payload.cmp) {
      const gdprApplies = bidderRequest.gdprConsent.gdprApplies;
      if (gdprApplies !== undefined) payload['ga'] = gdprApplies;
      payload['cs'] = bidderRequest.gdprConsent.consentString;
    }

    const payloadString = JSON.stringify(payload);

    return {
      method: 'POST',
      url: SSP_ENDPOINT,
      data: payloadString,
      options: {
        contentType: 'application/json'
      }
    }
  },

  /**
   * Unpack the response from the server into a list of bids.
   *
   * @param {ServerResponse} serverResponse A successful response from the server.
   * @return {Bid[]} An array of bids which were nested inside the server.
   */
  interpretResponse: function(serverResponse, bidRequest) {
    const bidRequests = JSON.parse(bidRequest.data).bidRequests;
    const serverBody = serverResponse.body;

    if (serverBody && serverBody.bids && isArray(serverBody.bids)) {
      return _map(serverBody.bids, function(bid) {
        const rawBid = ((bidRequests) || []).find(function (item) {
          return item.bidId === bid.bidId;
        });
        bid.placement = rawBid.placement;
        bid.transactionId = rawBid.transactionId;
        bid.placeId = rawBid.placeId;
        return buildBid(bid);
      });
    } else {
      return [];
    }
  }

}
registerBidder(spec);
