import { expect } from 'chai';
import { spec } from 'modules/nextrollBidAdapter.js';
import * as utils from 'src/utils.js';
import { deepClone } from '../../../src/utils';

describe('nextrollBidAdapter', function() {
  let utilsMock;
  beforeEach(function () {
    utilsMock = sinon.mock(utils);
  });

  afterEach(function() {
    global.NextRoll = undefined;
    utilsMock.restore();
  });

  const validBid = {
    bidder: 'nextroll',
    adUnitCode: 'adunit-code',
    bidId: 'bid_id',
    sizes: [[300, 200]],
    params: {
      bidfloor: 1,
      zoneId: 'zone1',
      publisherId: 'publisher_id'
    }
  };
  const bidWithoutValidId = { id: '' };
  const bidWithoutId = { params: { zoneId: 'zone1' } };

  describe('nativeBidRequest', () => {
    it('validates native spec', () => {
      const nativeAdUnit = [{
        bidder: 'nextroll',
        adUnitCode: 'adunit-code',
        bidId: 'bid_id',
        mediaTypes: {
          native: {
            title: {required: true, len: 80},
            image: {required: true, sizes: [728, 90]},
            sponsoredBy: {required: false, len: 20},
            clickUrl: {required: true},
            body: {required: true, len: 25},
            icon: {required: true, sizes: [50, 50], aspect_ratios: [{ratio_height: 3, ratio_width: 4}]},
            someRandomAsset: {required: false, len: 100} // This should be ignored
          }
        },
        params: {
          bidfloor: 1,
          zoneId: 'zone1',
          publisherId: 'publisher_id'
        }
      }];

      const request = spec.buildRequests(nativeAdUnit)
      const assets = request[0].data.imp.native.request.native.assets

      const excptedAssets = [
        {id: 1, required: 1, title: {len: 80}},
        {id: 2, required: 1, img: {w: 728, h: 90, wmin: 1, hmin: 1, type: 3}},
        {id: 3, required: 1, img: {w: 50, h: 50, wmin: 4, hmin: 3, type: 1}},
        {id: 5, required: 0, data: {len: 20, type: 1}},
        {id: 6, required: 1, data: {len: 25, type: 2}}
      ]
      expect(assets).to.be.deep.equal(excptedAssets)
    })
  })

  describe('isBidRequestValid', function() {
    it('validates the bids correctly when the bid has an id', function() {
      expect(spec.isBidRequestValid(validBid)).to.be.true;
    });

    it('validates the bids correcly when the bid does not have an id', function() {
      expect(spec.isBidRequestValid(bidWithoutValidId)).to.be.false;
      expect(spec.isBidRequestValid(bidWithoutId)).to.be.false;
    });
  });

  describe('buildRequests', function() {
    it('builds the same amount of requests as valid requests it takes', function() {
      expect(spec.buildRequests([validBid, validBid], {})).to.be.lengthOf(2);
    });

    it('doest not build a request when there is no valid requests', function () {
      expect(spec.buildRequests([], {})).to.be.lengthOf(0);
    });

    it('builds a request with POST method', function () {
      expect(spec.buildRequests([validBid], {})[0].method).to.equal('POST');
    });

    it('builds a request with cookies method', function () {
      expect(spec.buildRequests([validBid], {})[0].options.withCredentials).to.be.true;
    });

    it('builds a request with id, url and imp object', function () {
      const request = spec.buildRequests([validBid], {})[0];
      expect(request.data.id).to.be.an('string').that.is.not.empty;
      expect(request.url).to.equal('https://d.adroll.com/bid/prebid/');
      expect(request.data.imp).to.exist.and.to.be.a('object');
    });

    it('builds a request with site and device information', function () {
      const request = spec.buildRequests([validBid], {})[0];

      expect(request.data.site).to.exist.and.to.be.a('object');
      expect(request.data.device).to.exist.and.to.be.a('object');
    });

    it('builds a request with a complete imp object', function () {
      const request = spec.buildRequests([validBid], {})[0];

      expect(request.data.imp.id).to.equal('bid_id');
      expect(request.data.imp.bidfloor).to.be.equal(1);
      expect(request.data.imp.banner).to.exist.and.to.be.a('object');
      expect(request.data.imp.ext.zone.id).to.be.equal('zone1');
    });

    it('builds a request with the correct floor object', function () {
      // bidfloor is defined, getFloor isn't
      let bid = deepClone(validBid);
      let request = spec.buildRequests([bid], {})[0];
      expect(request.data.imp.bidfloor).to.be.equal(1);

      // bidfloor not defined, getFloor not defined
      bid = deepClone(validBid);
      bid.params.bidfloor = null;
      request = spec.buildRequests([bid], {})[0];
      expect(request.data.imp.bidfloor).to.not.exist;

      // bidfloor defined, getFloor defined, use getFloor
      const getFloorResponse = { currency: 'USD', floor: 3 };
      bid = deepClone(validBid);
      bid.getFloor = () => getFloorResponse;
      request = spec.buildRequests([bid], {})[0];

      expect(request.data.imp.bidfloor).to.exist.and.to.equal(3);
    });

    it('includes the sizes into the request correctly', function () {
      const bannerObject = spec.buildRequests([validBid], {})[0].data.imp.banner;

      expect(bannerObject.format).to.exist;
      expect(bannerObject.format).to.be.lengthOf(1);
      expect(bannerObject.format[0].w).to.be.equal(300);
      expect(bannerObject.format[0].h).to.be.equal(200);
    });

    it('sets the CCPA consent string', function () {
      const us_privacy = '1YYY';
      const request = spec.buildRequests([validBid], {'uspConsent': us_privacy})[0];

      expect(request.data.regs.ext.us_privacy).to.be.equal(us_privacy);
    });
  });

  describe('interpretResponse', function () {
    const responseBody = {
      id: 'bidresponse_id',
      dealId: 'deal_id',
      seatbid: [
        {
          bid: [
            {
              price: 1.2,
              w: 300,
              h: 200,
              crid: 'crid1',
              adm: 'adm1'
            }
          ]
        },
        {
          bid: [
            {
              price: 2.1,
              w: 250,
              h: 300,
              crid: 'crid2',
              adm: 'adm2'
            }
          ]
        }
      ]
    };

    it('returns an empty list when there is no response body', function () {
      expect(spec.interpretResponse({}, {})).to.be.eql([]);
    });

    it('builds the same amount of responses as server responses it receives', function () {
      expect(spec.interpretResponse({body: responseBody}, {})).to.be.lengthOf(2);
    });

    it('builds a response with the expected fields', function () {
      const response = spec.interpretResponse({body: responseBody}, {})[0];

      expect(response.requestId).to.be.equal('bidresponse_id');
      expect(response.cpm).to.be.equal(1.2);
      expect(response.width).to.be.equal(300);
      expect(response.height).to.be.equal(200);
      expect(response.creativeId).to.be.equal('crid1');
      expect(response.dealId).to.be.equal('deal_id');
      expect(response.currency).to.be.equal('USD');
      expect(response.netRevenue).to.be.equal(true);
      expect(response.ttl).to.be.equal(300);
      expect(response.ad).to.be.equal('adm1');
    });
  });

  describe('interpret native response', () => {
    const clickUrl = 'https://clickurl.com/with/some/path'
    const titleText = 'Some title'
    const imgW = 300
    const imgH = 250
    const imgUrl = 'https://clickurl.com/img.png'
    const brandText = 'Some Brand'
    const impUrl = 'https://clickurl.com/imptracker'

    const responseBody = {
      body: {
        id: 'bidresponse_id',
        seatbid: [{
          bid: [{
            price: 1.2,
            crid: 'crid1',
            adm: {
              link: {url: clickUrl},
              assets: [
                {id: 1, title: {text: titleText}},
                {id: 2, img: {w: imgW, h: imgH, url: imgUrl}},
                {id: 5, data: {value: brandText}}
              ],
              imptrackers: [impUrl]
            }
          }]
        }]
      }
    };

    it('Should interpret response', () => {
      const response = spec.interpretResponse(utils.deepClone(responseBody))
      const expectedResponse = {
        clickUrl: clickUrl,
        impressionTrackers: [impUrl],
        privacyLink: 'https://app.adroll.com/optout/personalized',
        privacyIcon: 'https://s.adroll.com/j/ad-choices-small.png',
        title: titleText,
        image: {url: imgUrl, width: imgW, height: imgH},
        sponsoredBy: brandText,
        clickTrackers: [],
        jstracker: []
      }

      expect(response[0].native).to.be.deep.equal(expectedResponse)
    })

    it('Should interpret all assets', () => {
      const allAssetsResponse = utils.deepClone(responseBody)
      const iconUrl = imgUrl + '?icon=true', iconW = 10, iconH = 15
      const logoUrl = imgUrl + '?logo=true', logoW = 20, logoH = 25
      const bodyText = 'Some body text'

      allAssetsResponse.body.seatbid[0].bid[0].adm.assets.push(...[
        {id: 3, img: {w: iconW, h: iconH, url: iconUrl}},
        {id: 4, img: {w: logoW, h: logoH, url: logoUrl}},
        {id: 6, data: {value: bodyText}}
      ])

      const response = spec.interpretResponse(allAssetsResponse)
      const expectedResponse = {
        clickUrl: clickUrl,
        impressionTrackers: [impUrl],
        jstracker: [],
        clickTrackers: [],
        privacyLink: 'https://app.adroll.com/optout/personalized',
        privacyIcon: 'https://s.adroll.com/j/ad-choices-small.png',
        title: titleText,
        image: {url: imgUrl, width: imgW, height: imgH},
        icon: {url: iconUrl, width: iconW, height: iconH},
        logo: {url: logoUrl, width: logoW, height: logoH},
        body: bodyText,
        sponsoredBy: brandText
      }

      expect(response[0].native).to.be.deep.equal(expectedResponse)
    })
  })
});
