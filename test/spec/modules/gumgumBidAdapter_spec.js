import { BANNER, VIDEO } from 'src/mediaTypes.js';

import { config } from 'src/config.js';
import { expect } from 'chai';
import { newBidder } from 'src/adapters/bidderFactory.js';
import { spec } from 'modules/gumgumBidAdapter.js';

const ENDPOINT = 'https://g2.gumgum.com/hbid/imp';
const JCSI = { t: 0, rq: 8, pbv: '$prebid.version$' }

describe('gumgumAdapter', function () {
  const adapter = newBidder(spec);

  describe('inherited functions', function () {
    it('exists and is a function', function () {
      expect(adapter.callBids).to.exist.and.to.be.a('function');
    });
  });

  describe('isBidRequestValid', function () {
    const bid = {
      'bidder': 'gumgum',
      'params': {
        'inScreen': '10433394',
        'bidfloor': 0.05
      },
      'adUnitCode': 'adunit-code',
      'mediaTypes': {
        'banner': {
          sizes: [[300, 250], [300, 600], [1, 1]]
        }
      },
      'bidId': '30b31c1838de1e',
      'bidderRequestId': '22edbae2733bf6',
      'auctionId': '1d1a030790a475',
    };

    it('should return true when required params found', function () {
      const zoneBid = { ...bid, params: { 'zone': '123' } };
      const pubIdBid = { ...bid, params: { 'pubId': 123 } };
      expect(spec.isBidRequestValid(bid)).to.equal(true);
      expect(spec.isBidRequestValid(zoneBid)).to.equal(true);
      expect(spec.isBidRequestValid(pubIdBid)).to.equal(true);
    });

    it('should return true when required params found', function () {
      const invalidBid = Object.assign({}, bid);
      delete invalidBid.params;
      invalidBid.params = {
        'inSlot': '789'
      };

      expect(spec.isBidRequestValid(bid)).to.equal(true);
    });

    it('should return true when inslot sends sizes and trackingid', function () {
      const invalidBid = Object.assign({}, bid);
      delete invalidBid.params;
      invalidBid.params = {
        'inSlot': '789',
        'sizes': [[0, 1], [2, 3], [4, 5], [6, 7]]
      };

      expect(spec.isBidRequestValid(invalidBid)).to.equal(true);
    });

    it('should return false when no unit type is specified', function () {
      const invalidBid = Object.assign({}, bid);
      delete invalidBid.params;
      invalidBid.params = {
        'placementId': 0
      };
      expect(spec.isBidRequestValid(invalidBid)).to.equal(false);
    });

    it('should return false when bidfloor is not a number', function () {
      const invalidBid = Object.assign({}, bid);
      delete invalidBid.params;
      invalidBid.params = {
        'inSlot': '789',
        'bidfloor': '0.50'
      };
      expect(spec.isBidRequestValid(invalidBid)).to.equal(false);
    });

    it('should return false if invalid request id is found', function () {
      const bidRequest = {
        id: 12345,
        sizes: [[300, 250], [1, 1]],
        url: ENDPOINT,
        method: 'GET',
        pi: 3,
        data: { t: '10433394' }
      };
      let body;
      spec.interpretResponse({ body }, bidRequest); // empty response
      expect(spec.isBidRequestValid(bid)).to.be.equal(false);
    });
  });

  describe('buildRequests', function () {
    const sizesArray = [[300, 250], [300, 600]];
    const bidderRequest = {
      ortb2: {
        site: {
          content: {
            data: [{
              name: 'www.iris.com',
              ext: {
                segtax: 500,
                cids: ['iris_c73g5jq96mwso4d8']
              }
            }],
            url: 'http://pub.com/news',
          },
          page: 'http://pub.com/news',
          ref: 'http://google.com',
          publisher: {
            id: 'p10000',
            domain: 'pub.com'
          }
        }
      }
    };

    const bidRequests = [
      {
        gppString: 'DBACNYA~CPXxRfAPXxRfAAfKABENB-CgAAAAAAAAAAYgAAAAAAAA~1YNN',
        gppSid: [7],
        bidder: 'gumgum',
        params: {
          inSlot: 9
        },
        mediaTypes: {
          banner: {
            sizes: sizesArray
          }
        },
        userId: {
          id5id: {
            uid: 'uid-string',
            ext: {
              linkType: 2
            }
          }
        },
        pubProvidedId: [
          {
            uids: [
              {
                ext: {
                  stype: 'ppuid',
                },
                id: 'aac4504f-ef89-401b-a891-ada59db44336',
              },
            ],
            source: 'sonobi.com',
          },
          {
            uids: [
              {
                ext: {
                  stype: 'ppuid',
                },
                id: 'y-zqTHmW9E2uG3jEETC6i6BjGcMhPXld2F~A',
              },
            ],
            source: 'aol.com',
          },
        ],
        adUnitCode: 'adunit-code',
        sizes: sizesArray,
        bidId: '30b31c1838de1e',
        ortb2: {
          source: {
            ext: {
              schain: {
                ver: '1.0',
                complete: 1,
                nodes: [
                  {
                    asi: 'exchange1.com',
                    sid: '1234',
                    hp: 1,
                    rid: 'bid-request-1',
                    name: 'publisher',
                    domain: 'publisher.com'
                  },
                  {
                    asi: 'exchange2.com',
                    sid: 'abcd',
                    hp: 1,
                    rid: 'bid-request-2',
                    name: 'intermediary',
                    domain: 'intermediary.com'
                  }
                ]
              }
            }
          }
        }
      }
    ];
    const vidMediaTypes = {
      video: {
        playerSize: [640, 480],
        context: 'instream',
        minduration: 1,
        maxduration: 2,
        linearity: 1,
        startdelay: 1,
        placement: 123456,
        plcmt: 3,
        protocols: [1, 2]
      }
    };
    const zoneParam = { 'zone': '123a' };
    const pubIdParam = { 'pubId': 123 };

    it('should set aun if the adUnitCode is available', function () {
      const request = { ...bidRequests[0] };
      const bidRequest = spec.buildRequests([request])[0];
      expect(bidRequest.data.aun).to.equal(bidRequests[0].adUnitCode);
      expect(bidRequest.data.displaymanager).to.equal('Prebid.js - gumgum');
      expect(bidRequest.data.displaymanagerver).to.equal(JCSI.pbv);
    });
    it('should set pubProvidedId if the uid and  pubProvidedId are available', function () {
      const request = { ...bidRequests[0] };
      const bidRequest = spec.buildRequests([request])[0];
      expect(bidRequest.data.pubProvidedId).to.equal(JSON.stringify(bidRequests[0].userId.pubProvidedId));
    });
    it('should set id5Id and id5IdLinkType if the uid and  linkType are available', function () {
      const request = { ...bidRequests[0] };
      const bidRequest = spec.buildRequests([request])[0];
      expect(bidRequest.data.id5Id).to.equal(bidRequests[0].userId.id5id.uid);
      expect(bidRequest.data.id5IdLinkType).to.equal(bidRequests[0].userId.id5id.ext.linkType);
    });

    it('should set pubId param if found', function () {
      const request = { ...bidRequests[0], params: pubIdParam };
      const bidRequest = spec.buildRequests([request])[0];
      expect(bidRequest.data.pubId).to.equal(pubIdParam.pubId);
    });

    it('should set t param when zone param is found', function () {
      const request = { ...bidRequests[0], params: zoneParam };
      const bidRequest = spec.buildRequests([request])[0];
      expect(bidRequest.data.t).to.equal(zoneParam.zone);
    });

    it('should send the banner dimension with the greatest width or height for slot ads', function () {
      const legacyRequest = { ...bidRequests[0] };
      const slotZoneRequest = { ...bidRequests[0], params: { ...zoneParam, slot: 9 } }
      const slotPubIdRequest = { ...bidRequests[0], params: { ...pubIdParam, slot: 9 } }
      const legacyBidRequest = spec.buildRequests([legacyRequest])[0];
      const slotZoneBidRequest = spec.buildRequests([slotZoneRequest])[0];
      const slotPubIdBidRequest = spec.buildRequests([slotPubIdRequest])[0];
      expect(legacyBidRequest.data.maxw).to.equal(300);
      expect(legacyBidRequest.data.maxh).to.equal(600);
      expect(slotZoneBidRequest.data.maxw).to.equal(300);
      expect(slotZoneBidRequest.data.maxh).to.equal(600);
      expect(slotPubIdBidRequest.data.maxw).to.equal(300);
      expect(slotPubIdBidRequest.data.maxh).to.equal(600);
    });

    // if slot ID is set up incorrectly by a pub, we should send the invalid ID to be
    // invalidated by ad server instead of trying to force integer type. forcing
    // integer type can result in incorrect slot IDs that correlate to the incorrect pub ID
    it('should send params.slot or params.inSlot as string when configured incorrectly', function () {
      const invalidSlotId = '9gkal1cn';
      const slotRequest = { ...bidRequests[0] };
      const legacySlotRequest = { ...bidRequests[0] };
      let req;
      let legReq;

      slotRequest.params.slot = invalidSlotId;
      legacySlotRequest.params.inSlot = invalidSlotId;

      req = spec.buildRequests([slotRequest])[0];
      legReq = spec.buildRequests([legacySlotRequest])[0];

      expect(req.data.si).to.equal(invalidSlotId);
      expect(legReq.data.si).to.equal(invalidSlotId);
    });

    it('should set the iriscat param when found', function () {
      const request = { ...bidRequests[0], params: { iriscat: 'abc123' } }
      const bidRequest = spec.buildRequests([request])[0];
      expect(bidRequest.data).to.have.property('iriscat');
    });
    it('should set the irisid param when found iris_c73g5jq96mwso4d8', function() {
      const request = { ...bidRequests[0], params: { irisid: 'abc123' } };
      const bidRequest = spec.buildRequests([request], bidderRequest)[0];
      expect(bidRequest.data).to.have.property('irisid', 'iris_c73g5jq96mwso4d8');
    });
    it('should set the curl param if present', function() {
      const request = { ...bidRequests[0] };
      const bidRequest = spec.buildRequests([request], bidderRequest)[0];
      expect(bidRequest.data).to.have.property('curl', 'http://pub.com/news');
    });
    it('should not set the iriscat param when not found', function () {
      const request = { ...bidRequests[0] }
      const bidRequest = spec.buildRequests([request])[0];
      expect(bidRequest.data).to.not.have.property('iriscat');
    });
    it('should not set the irisid param when not found', function () {
      const request = { ...bidRequests[0] }
      const bidRequest = spec.buildRequests([request])[0];
      expect(bidRequest.data).to.not.have.property('irisid');
    });

    it('should not set the irisid param when not of type string', function () {
      const request = { ...bidRequests[0], params: { irisid: 123456 } }
      const bidRequest = spec.buildRequests([request])[0];
      expect(bidRequest.data).to.not.have.property('irisid');
    });

    it('should set the global placement id (gpid) if in adserver property', function () {
      const req = { ...bidRequests[0],
        ortb2Imp: {
          ext: {
            gpid: '/17037559/jeusol/jeusol_D_1',
            data: {
              adserver: {
                name: 'test',
                adslot: 123456
              }
            }
          }
        } }
      const bidRequest = spec.buildRequests([req])[0];
      expect(bidRequest.data).to.have.property('gpid');
      expect(bidRequest.data.gpid).to.equal('/17037559/jeusol/jeusol_D_1');
    });
    it('should set ae value to 1 for PAAPI', function () {
      const req = { ...bidRequests[0],
        ortb2Imp: {
          ext: {
            ae: 1,
            data: {
              adserver: {
                name: 'test',
                adslot: 123456
              }
            }
          }
        } }
      const bidRequest = spec.buildRequests([req])[0];
      expect(bidRequest.data).to.have.property('ae');
      expect(bidRequest.data.ae).to.equal(true);
    });

    it('should set the global placement id (gpid) if in gpid property', function () {
      const gpid = 'abc123'
      const req = { ...bidRequests[0], ortb2Imp: { ext: { data: {}, gpid } } }
      const bidRequest = spec.buildRequests([req])[0];
      expect(bidRequest.data).to.have.property('gpid');
      expect(bidRequest.data.gpid).to.equal(gpid);
    });

    it('should set the global placement id (gpid) if media type is video', function () {
      const gpid = 'cde456'
      const req = { ...bidRequests[0], ortb2Imp: { ext: { data: {}, gpid } }, params: zoneParam, mediaTypes: vidMediaTypes }
      const bidRequest = spec.buildRequests([req])[0];
      expect(bidRequest.data).to.have.property('gpid');
      expect(bidRequest.data.gpid).to.equal(gpid);
    });

    it('should set the bid floor if getFloor module is not present but static bid floor is defined', function () {
      const req = { ...bidRequests[0], params: { bidfloor: 42 } }
      const bidRequest = spec.buildRequests([req])[0];
      expect(bidRequest.data).to.have.property('fp');
      expect(bidRequest.data.fp).to.equal(42);
    });

    describe('product id', function () {
      it('should set the correct pi param if native param is found', function () {
        const request = { ...bidRequests[0], params: { ...zoneParam, native: 2 } };
        const bidRequest = spec.buildRequests([request])[0];
        expect(bidRequest.data.pi).to.equal(5);
      });
      it('should set the correct pi param for video', function () {
        const request = { ...bidRequests[0], params: zoneParam, mediaTypes: vidMediaTypes };
        const bidRequest = spec.buildRequests([request])[0];
        expect(bidRequest.data.pi).to.equal(7);
      });
      it('should set the correct pi param for invideo', function () {
        const invideo = { video: { ...vidMediaTypes.video, linearity: 2 } };
        const request = { ...bidRequests[0], params: zoneParam, mediaTypes: invideo };
        const bidRequest = spec.buildRequests([request])[0];
        expect(bidRequest.data.pi).to.equal(6);
      });
      it('should set the correct pi param if slot param is found', function () {
        const request = { ...bidRequests[0], params: { ...zoneParam, slot: '123s' } };
        const bidRequest = spec.buildRequests([request])[0];
        expect(bidRequest.data.pi).to.equal(3);
      });
      it('should set the correct pi param if product param is found and is equal to skins', function () {
        const request = { ...bidRequests[0], params: { ...zoneParam, product: 'Skins' } };
        const bidRequest = spec.buildRequests([request])[0];
        expect(bidRequest.data.pi).to.equal(8);
      });
      it('should default the pi param to 2 if only zone or pubId param is found', function () {
        const zoneRequest = { ...bidRequests[0], params: zoneParam };
        const pubIdRequest = { ...bidRequests[0], params: pubIdParam };
        const zoneBidRequest = spec.buildRequests([zoneRequest])[0];
        const pubIdBidRequest = spec.buildRequests([pubIdRequest])[0];
        expect(zoneBidRequest.data.pi).to.equal(2);
        expect(pubIdBidRequest.data.pi).to.equal(2);
      });
    });

    it('should return a defined sizes field for video', function () {
      const request = { ...bidRequests[0], mediaTypes: vidMediaTypes, params: { 'videoPubID': 123 } };
      const bidRequest = spec.buildRequests([request])[0];
      expect(bidRequest.sizes).to.equal(vidMediaTypes.video.playerSize);
    });
    it('should handle multiple sizes for inslot', function () {
      const mediaTypes = { banner: { sizes: [[300, 250], [300, 600]] } }
      const request = { ...bidRequests[0], mediaTypes };
      const bidRequest = spec.buildRequests([request])[0];
      expect(bidRequest.data.bf).to.equal('300x250,300x600');
    });
    describe('floorModule', function () {
      const floorTestData = {
        'currency': 'USD',
        'floor': 1.50
      };
      bidRequests[0].getFloor = _ => {
        return floorTestData;
      };
      it('should return the value from getFloor if present', function () {
        const request = spec.buildRequests(bidRequests)[0];
        expect(request.data.fp).to.equal(floorTestData.floor);
      });
      it('should return the getFloor.floor value if it is greater than bidfloor', function () {
        const bidfloor = 0.80;
        const request = { ...bidRequests[0] };
        request.params.bidfloor = bidfloor;
        const bidRequest = spec.buildRequests([request])[0];
        expect(bidRequest.data.fp).to.equal(floorTestData.floor);
      });
      it('should return the bidfloor value if it is greater than getFloor.floor', function () {
        const bidfloor = 1.80;
        const request = { ...bidRequests[0] };
        request.params.bidfloor = bidfloor;
        const bidRequest = spec.buildRequests([request])[0];
        expect(bidRequest.data.fp).to.equal(bidfloor);
      });
      it('should return a floor currency', function () {
        const request = spec.buildRequests(bidRequests)[0];
        expect(request.data.fpc).to.equal(floorTestData.currency);
      })
    });

    it('sends bid request to ENDPOINT via GET', function () {
      const request = spec.buildRequests(bidRequests)[0];
      expect(request.url).to.equal(ENDPOINT);
      expect(request.method).to.equal('GET');
      expect(request.id).to.equal('30b31c1838de1e');
    });
    it('should set t and fp parameters in bid request if inScreen request param is found', function () {
      const request = Object.assign({}, bidRequests[0]);
      delete request.params;
      request.params = {
        'inScreen': '10433394',
        'bidfloor': 0.05
      };
      const bidRequest = spec.buildRequests([request])[0];
      expect(bidRequest.data.pi).to.equal(2);
      expect(bidRequest.data).to.include.any.keys('t');
      expect(bidRequest.data).to.include.any.keys('fp');
    });
    it('should set iriscat parameter if iriscat param is found and is of type string', function () {
      const iriscat = 'segment';
      const request = { ...bidRequests[0] };
      request.params = { ...request.params, iriscat };
      const bidRequest = spec.buildRequests([request])[0];
      expect(bidRequest.data.iriscat).to.equal(iriscat);
    });
    it('should not send iriscat parameter if iriscat param is not found', function () {
      const request = { ...bidRequests[0] };
      const bidRequest = spec.buildRequests([request])[0];
      expect(bidRequest.data.iriscat).to.be.undefined;
    });
    it('should not send iriscat parameter if iriscat param is not of type string', function () {
      const iriscat = 123;
      const request = { ...bidRequests[0] };
      request.params = { ...request.params, iriscat };
      const bidRequest = spec.buildRequests([request])[0];
      expect(bidRequest.data.iriscat).to.be.undefined;
    });
    it('should send pubId if inScreenPubID param is specified', function () {
      const request = Object.assign({}, bidRequests[0]);
      delete request.params;
      request.params = {
        'inScreenPubID': 123
      };
      const bidRequest = spec.buildRequests([request])[0];
      expect(bidRequest.data).to.include.any.keys('pubId');
      expect(bidRequest.data.pubId).to.equal(request.params.inScreenPubID);
      expect(bidRequest.data).to.not.include.any.keys('t');
    });
    it('should send pubId if videoPubID param is specified', function () {
      const request = { ...bidRequests[0], mediaTypes: vidMediaTypes, params: { 'videoPubID': 123 } };
      const bidRequest = spec.buildRequests([request])[0];
      expect(bidRequest.data).to.include.any.keys('pubId');
      expect(bidRequest.data.pubId).to.equal(request.params.videoPubID);
      expect(bidRequest.data).to.not.include.any.keys('t');
    });
    it('should set a ni parameter in bid request if ICV request param is found', function () {
      const request = Object.assign({}, bidRequests[0]);
      delete request.params;
      request.params = {
        'ICV': '10433395'
      };
      const bidRequest = spec.buildRequests([request])[0];
      expect(bidRequest.data.pi).to.equal(5);
      expect(bidRequest.data).to.include.any.keys('ni');
    });
    it('should add parameters associated with video if video request param is found', function () {
      const videoVals = {
        playerSize: [640, 480],
        context: 'instream',
        minduration: 1,
        maxduration: 2,
        linearity: 1,
        startdelay: 1,
        placement: 123456,
        plcmt: 3,
        protocols: [1, 2],
        skip: 1,
        api: [1, 2],
        mimes: ['video/mp4', 'video/webm'],
        playbackmethod: [1, 2],
        playbackend: 2
      };
      const request = Object.assign({}, bidRequests[0]);
      delete request.params;
      request.mediaTypes = {
        video: videoVals
      };
      request.params = {
        'video': '10433395'
      };
      const bidRequest = spec.buildRequests([request])[0];
      // 7 is video product line
      expect(bidRequest.data.pi).to.eq(7);
      expect(bidRequest.data.mind).to.eq(videoVals.minduration);
      expect(bidRequest.data.maxd).to.eq(videoVals.maxduration);
      expect(bidRequest.data.li).to.eq(videoVals.linearity);
      expect(bidRequest.data.sd).to.eq(videoVals.startdelay);
      expect(bidRequest.data.pt).to.eq(videoVals.placement);
      expect(bidRequest.data.vplcmt).to.eq(videoVals.plcmt);
      expect(bidRequest.data.pr).to.eq(videoVals.protocols.join(','));
      expect(bidRequest.data.viw).to.eq(videoVals.playerSize[0].toString());
      expect(bidRequest.data.vih).to.eq(videoVals.playerSize[1].toString());
      expect(bidRequest.data.skip).to.eq(videoVals.skip);
      expect(bidRequest.data.api).to.eq(videoVals.api.join(','));
      expect(bidRequest.data.mimes).to.eq(videoVals.mimes.join(','));
      expect(bidRequest.data.pbm).to.eq(videoVals.playbackmethod.join(','));
      expect(bidRequest.data.pbe).to.eq(videoVals.playbackend);
    });
    it('should add parameters associated with invideo if invideo request param is found', function () {
      const inVideoVals = {
        playerSize: [640, 480],
        context: 'instream',
        minduration: 1,
        maxduration: 2,
        linearity: 1,
        startdelay: 1,
        placement: 123456,
        plcmt: 3,
        protocols: [1, 2],
        skip: 1,
        api: [1, 2],
        mimes: ['video/mp4', 'video/webm'],
        playbackmethod: [6],
        playbackend: 1
      };
      const request = Object.assign({}, bidRequests[0]);
      delete request.params;
      request.mediaTypes = {
        video: inVideoVals
      };
      request.params = {
        'inVideo': '10433395'
      };
      const bidRequest = spec.buildRequests([request])[0];
      // 6 is invideo product line
      expect(bidRequest.data.pi).to.eq(6);
      expect(bidRequest.data.mind).to.eq(inVideoVals.minduration);
      expect(bidRequest.data.maxd).to.eq(inVideoVals.maxduration);
      expect(bidRequest.data.li).to.eq(inVideoVals.linearity);
      expect(bidRequest.data.sd).to.eq(inVideoVals.startdelay);
      expect(bidRequest.data.pt).to.eq(inVideoVals.placement);
      expect(bidRequest.data.vplcmt).to.eq(inVideoVals.plcmt);
      expect(bidRequest.data.pr).to.eq(inVideoVals.protocols.join(','));
      expect(bidRequest.data.viw).to.eq(inVideoVals.playerSize[0].toString());
      expect(bidRequest.data.vih).to.eq(inVideoVals.playerSize[1].toString());
      expect(bidRequest.data.skip).to.eq(inVideoVals.skip);
      expect(bidRequest.data.api).to.eq(inVideoVals.api.join(','));
      expect(bidRequest.data.mimes).to.eq(inVideoVals.mimes.join(','));
      expect(bidRequest.data.pbm).to.eq(inVideoVals.playbackmethod.join(','));
      expect(bidRequest.data.pbe).to.eq(inVideoVals.playbackend);
    });
    it('should not add additional parameters depending on params field', function () {
      const request = spec.buildRequests(bidRequests)[0];
      expect(request.data).to.not.include.any.keys('ni');
      expect(request.data).to.not.include.any.keys('t');
      expect(request.data).to.not.include.any.keys('eAdBuyId');
      expect(request.data).to.not.include.any.keys('adBuyId');
    });
    it('should set pubProvidedId if the uid and  pubProvidedId are available', function () {
      const request = { ...bidRequests[0] };
      const bidRequest = spec.buildRequests([request])[0];
      expect(bidRequest.data.pubProvidedId).to.equal(JSON.stringify(bidRequests[0].userId.pubProvidedId));
    });

    it('should add gdpr consent parameters if gdprConsent is present', function () {
      const gdprConsent = { consentString: 'BOJ/P2HOJ/P2HABABMAAAAAZ+A==', gdprApplies: true };
      const fakeBidRequest = { gdprConsent: gdprConsent };
      const bidRequest = spec.buildRequests(bidRequests, fakeBidRequest)[0];
      expect(bidRequest.data.gdprApplies).to.eq(1);
      expect(bidRequest.data.gdprConsent).to.eq('BOJ/P2HOJ/P2HABABMAAAAAZ+A==');
    });
    it('should handle gdprConsent is present but values are undefined case', function () {
      const gdprConsent = { consent_string: undefined, gdprApplies: undefined };
      const fakeBidRequest = { gdprConsent: gdprConsent };
      const bidRequest = spec.buildRequests(bidRequests, fakeBidRequest)[0];
      expect(bidRequest.data).to.not.include.any.keys('gdprConsent')
    });
    it('should add gpp parameters if gppConsent is present', function () {
      const gppConsent = { gppString: 'DBACNYA~CPXxRfAPXxRfAAfKABENB-CgAAAAAAAAAAYgAAAAAAAA~1YNN', applicableSections: [7] }
      const fakeBidRequest = { gppConsent: gppConsent };
      const bidRequest = spec.buildRequests(bidRequests, fakeBidRequest)[0];
      expect(bidRequest.data.gppString).to.equal(gppConsent.gppString);
      expect(bidRequest.data.gppSid).to.equal(gppConsent.applicableSections.join(','));
      expect(bidRequest.data.gppString).to.eq('DBACNYA~CPXxRfAPXxRfAAfKABENB-CgAAAAAAAAAAYgAAAAAAAA~1YNN');
    });
    it('should handle ortb2 parameters', function () {
      const ortb2 = {
        regs: {
          gpp: 'DBACNYA~CPXxRfAPXxRfAAfKABENB-CgAAAAAAAAAAYgAAAAAAAA~1YNN',
          gpp_sid: [7]
        }
      }
      const fakeBidRequest = { gppConsent: ortb2 };
      const bidRequest = spec.buildRequests(bidRequests, fakeBidRequest)[0];
      expect(bidRequest.data.gpp).to.eq(fakeBidRequest[0])
    });
    it('should handle gppConsent is present but values are undefined case', function () {
      const gppConsent = { gppString: undefined, applicableSections: undefined }
      const fakeBidRequest = { gppConsent: gppConsent };
      const bidRequest = spec.buildRequests(bidRequests, fakeBidRequest)[0];
      expect(bidRequest.data.gppString).to.equal('');
      expect(bidRequest.data.gppSid).to.equal('');
    });
    it('should handle ortb2  undefined parameters', function () {
      const ortb2 = {
        regs: {
          gpp: undefined,
          gpp_sid: undefined
        }
      }
      const fakeBidRequest = { gppConsent: ortb2 };
      const bidRequest = spec.buildRequests(bidRequests, fakeBidRequest)[0];
      expect(bidRequest.data.gppString).to.eq('')
      expect(bidRequest.data.gppSid).to.eq('')
    });
    it('should add DSA information to payload if available', function () {
      // Define the sample ORTB2 object with DSA information
      const ortb2 = {
        regs: {
          ext: {
            dsa: {
              dsarequired: '1',
              pubrender: '2',
              datatopub: '3',
              transparency: [{
                domain: 'test.com',
                dsaparams: [1, 2, 3]
              }]
            }
          }
        }
      };
      const fakeBidRequest = { ortb2 };
      // Call the buildRequests function to generate the bid request
      const [bidRequest] = spec.buildRequests(bidRequests, fakeBidRequest);
      // Assert that the DSA information in the bid request matches the provided ORTB2 data
      expect(bidRequest.data.dsa).to.deep.equal(JSON.stringify(fakeBidRequest.ortb2.regs.ext.dsa));
    });
    it('should not set coppa parameter if coppa config is set to false', function () {
      config.setConfig({
        coppa: false
      });
      const bidRequest = spec.buildRequests(bidRequests)[0];
      expect(bidRequest.data.coppa).to.eq(undefined);
    });
    it('should set coppa parameter to 1 if coppa config is set to true', function () {
      config.setConfig({
        coppa: true
      });
      const bidRequest = spec.buildRequests(bidRequests)[0];
      expect(bidRequest.data.coppa).to.eq(1);
    });
    it('should add uspConsent parameter if it is present in the bidderRequest', function () {
      const noUspBidRequest = spec.buildRequests(bidRequests)[0];
      const uspConsentObj = { uspConsent: '1YYY' };
      const bidRequest = spec.buildRequests(bidRequests, uspConsentObj)[0];
      expect(noUspBidRequest.data).to.not.include.any.keys('uspConsent');
      expect(bidRequest.data).to.include.any.keys('uspConsent');
      expect(bidRequest.data.uspConsent).to.eq(uspConsentObj.uspConsent);
    });
    it('should add a tdid parameter if request contains unified id from TradeDesk', function () {
      const unifiedId = {
        'userId': {
          'tdid': 'tradedesk-id'
        }
      }
      const request = Object.assign(unifiedId, bidRequests[0]);
      const bidRequest = spec.buildRequests([request])[0];
      expect(bidRequest.data.tdid).to.eq(unifiedId.userId.tdid);
    });
    it('should not add a tdid parameter if unified id is not found', function () {
      const request = spec.buildRequests(bidRequests)[0];
      expect(request.data).to.not.include.any.keys('tdid');
    });
    it('should send IDL envelope ID if available', function () {
      const idl_env = 'abc123';
      const request = { ...bidRequests[0], userId: { idl_env } };
      const bidRequest = spec.buildRequests([request])[0];

      expect(bidRequest.data).to.have.property('idl_env');
      expect(bidRequest.data.idl_env).to.equal(idl_env);
    });
    it('should not send IDL envelope if not available', function () {
      const request = { ...bidRequests[0] };
      const bidRequest = spec.buildRequests([request])[0];

      expect(bidRequest.data).to.not.have.property('idl_env');
    });
    it('should add a uid2 parameter if request contains uid2 id', function () {
      const uid2 = { id: 'sample-uid2' };
      const request = { ...bidRequests[0], userId: { uid2 } };
      const bidRequest = spec.buildRequests([request])[0];

      expect(bidRequest.data).to.have.property('uid2');
      expect(bidRequest.data.uid2).to.equal(uid2.id);
    });
    it('should not add uid2 parameter if uid2 id is not found', function () {
      const request = { ...bidRequests[0] };
      const bidRequest = spec.buildRequests([request])[0];

      expect(bidRequest.data).to.not.have.property('uid2');
    });
    it('should send schain parameter in serialized form', function () {
      const serializedForm = '1.0,1!exchange1.com,1234,1,bid-request-1,publisher,publisher.com!exchange2.com,abcd,1,bid-request-2,intermediary,intermediary.com'
      const request = spec.buildRequests(bidRequests)[0];
      expect(request.data).to.include.any.keys('schain');
      expect(request.data.schain).to.eq(serializedForm);
    });
    it('should send ns parameter if browser contains navigator.connection property', function () {
      const bidRequest = spec.buildRequests(bidRequests)[0];
      const connection = window.navigator && window.navigator.connection;
      if (connection) {
        const downlink = connection.downlink || connection.bandwidth;
        expect(bidRequest.data).to.include.any.keys('ns');
        expect(bidRequest.data.ns).to.eq(Math.round(downlink * 1024));
      } else {
        expect(bidRequest.data).to.not.include.any.keys('ns');
      }
    });
    it('adds jcsi param with correct keys', function () {
      const expectedKeys = Object.keys(JCSI).sort();
      const jcsi = JSON.stringify(JCSI);
      const bidRequest = spec.buildRequests(bidRequests)[0];
      const actualKeys = Object.keys(JSON.parse(bidRequest.data.jcsi)).sort();
      expect(actualKeys).to.eql(expectedKeys);
      expect(bidRequest.data.jcsi).to.eq(jcsi);
    });
    it('should include the local time and timezone offset', function () {
      const bidRequest = spec.buildRequests(bidRequests)[0];
      expect(!!bidRequest.data.lt).to.be.true;
    });

    it('should handle no gg params', function () {
      const bidRequest = spec.buildRequests(bidRequests, { refererInfo: { page: 'https://www.prebid.org/?param1=foo&param2=bar&param3=baz' } })[0];

      // no params are in object
      expect(bidRequest.data.hasOwnProperty('eAdBuyId')).to.be.false;
      expect(bidRequest.data.hasOwnProperty('adBuyId')).to.be.false;
      expect(bidRequest.data.hasOwnProperty('ggdeal')).to.be.false;
    });

    it('should handle encrypted ad buy id', function () {
      const bidRequest = spec.buildRequests(bidRequests, { refererInfo: { page: 'https://www.prebid.org/?param1=foo&ggad=bar&param3=baz' } })[0];

      // correct params are in object
      expect(bidRequest.data.hasOwnProperty('eAdBuyId')).to.be.true;
      expect(bidRequest.data.hasOwnProperty('adBuyId')).to.be.false;
      expect(bidRequest.data.hasOwnProperty('ggdeal')).to.be.false;

      // params are stripped from pu property
      expect(bidRequest.data.pu.includes('ggad')).to.be.false;
    });

    it('should handle unencrypted ad buy id', function () {
      const bidRequest = spec.buildRequests(bidRequests, { refererInfo: { page: 'https://www.prebid.org/?param1=foo&ggad=123&param3=baz' } })[0];

      // correct params are in object
      expect(bidRequest.data.hasOwnProperty('eAdBuyId')).to.be.false;
      expect(bidRequest.data.hasOwnProperty('adBuyId')).to.be.true;
      expect(bidRequest.data.hasOwnProperty('ggdeal')).to.be.false;

      // params are stripped from pu property
      expect(bidRequest.data.pu.includes('ggad')).to.be.false;
    });

    it('should handle multiple gg params', function () {
      const bidRequest = spec.buildRequests(bidRequests, { refererInfo: { page: 'https://www.prebid.org/?ggdeal=foo&ggad=bar&param3=baz' } })[0];

      // correct params are in object
      expect(bidRequest.data.hasOwnProperty('eAdBuyId')).to.be.true;
      expect(bidRequest.data.hasOwnProperty('adBuyId')).to.be.false;
      expect(bidRequest.data.hasOwnProperty('ggdeal')).to.be.true;

      // params are stripped from pu property
      expect(bidRequest.data.pu.includes('ggad')).to.be.false;
      expect(bidRequest.data.pu.includes('ggdeal')).to.be.false;
    });

    it('should handle ORTB2 device data', function () {
      const suaObject = {
        source: 2,
        platform: {
          brand: 'macOS',
          version: ['15', '5', '0']
        },
        browsers: [
          {
            brand: 'Google Chrome',
            version: ['137', '0', '7151', '41']
          },
          {
            brand: 'Chromium',
            version: ['137', '0', '7151', '41']
          },
          {
            brand: 'Not/A)Brand',
            version: ['24', '0', '0', '0']
          }
        ],
        mobile: 0,
        model: '',
        architecture: 'arm'
      };
      const ortb2 = {
        device: {
          w: 980,
          h: 1720,
          dnt: 0,
          ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/125.0.6422.80 Mobile/15E148 Safari/604.1',
          language: 'en',
          devicetype: 1,
          make: 'Apple',
          model: 'iPhone 12 Pro Max',
          os: 'iOS',
          osv: '17.4',
          ext: {fiftyonedegrees_deviceId: '17595-133085-133468-18092'},
          ip: '127.0.0.1',
          ipv6: '51dc:5e20:fd6a:c955:66be:03b4:dfa3:35b2',
          sua: suaObject

        },
      };

      const bidRequest = spec.buildRequests(bidRequests, { ortb2 })[0];

      expect(bidRequest.data.dnt).to.equal(ortb2.device.dnt);
      expect(bidRequest.data.ua).to.equal(ortb2.device.ua);
      expect(bidRequest.data.lang).to.equal(ortb2.device.language);
      expect(bidRequest.data.dt).to.equal(ortb2.device.devicetype);
      expect(bidRequest.data.make).to.equal(ortb2.device.make);
      expect(bidRequest.data.model).to.equal(ortb2.device.model);
      expect(bidRequest.data.os).to.equal(ortb2.device.os);
      expect(bidRequest.data.osv).to.equal(ortb2.device.osv);
      expect(bidRequest.data.foddid).to.equal(ortb2.device.ext.fiftyonedegrees_deviceId);
      expect(bidRequest.data.ip).to.equal(ortb2.device.ip);
      expect(bidRequest.data.ipv6).to.equal(ortb2.device.ipv6);
      expect(bidRequest.data).to.have.property('sua');
      expect(() => JSON.parse(bidRequest.data.sua)).to.not.throw();
      expect(JSON.parse(bidRequest.data.sua)).to.deep.equal(suaObject);
    });

    it('should set tId from ortb2Imp.ext.tid if available', function () {
      const ortb2Imp = { ext: { tid: 'test-tid-1' } };
      const request = { ...bidRequests[0], ortb2Imp };
      const bidRequest = spec.buildRequests([request])[0];
      expect(bidRequest.data.tId).to.equal('test-tid-1');
    });

    it('should set tId from bidderRequest.ortb2.source.tid if ortb2Imp.ext.tid is not available', function () {
      const ortb2 = { source: { tid: 'test-tid-2' } };
      const fakeBidRequest = { ortb2 };
      const bidRequest = spec.buildRequests(bidRequests, fakeBidRequest)[0];
      expect(bidRequest.data.tId).to.equal('test-tid-2');
    });

    it('should set tId to an empty string if neither ortb2Imp.ext.tid nor bidderRequest.ortb2.source.tid are available', function () {
      const bidRequest = spec.buildRequests(bidRequests)[0];
      expect(bidRequest.data.tId).to.equal('');
    })
  })

  describe('interpretResponse', function () {
    const metaData = { adomain: ['advertiser.com'], mediaType: BANNER }
    const serverResponse = {
      ad: {
        id: 29593,
        width: 300,
        height: 250,
        ipd: 2000,
        markup: '<html><h3>I am an ad</h3></html>',
        ii: true,
        du: null,
        price: 0,
        zi: 0,
        impurl: 'http://g2.gumgum.com/ad/view',
        clsurl: 'http://g2.gumgum.com/ad/close'
      },
      pag: {
        t: 'ggumtest',
        pvid: 'aa8bbb65-427f-4689-8cee-e3eed0b89eec',
        css: 'html { overflow-y: auto }',
        js: 'console.log("environment", env);'
      },
      jcsi: { t: 0, rq: 8 },
      thms: 10000,
      meta: metaData
    }
    const bidRequest = {
      id: 12345,
      sizes: [[300, 250], [1, 1]],
      url: ENDPOINT,
      method: 'GET',
      pi: 3
    }
    const expectedMetaData = { advertiserDomains: ['advertiser.com'], mediaType: BANNER };
    const expectedResponse = {
      ad: '<html><h3>I am an ad</h3></html>',
      cpm: 0,
      creativeId: 29593,
      currency: 'USD',
      height: '250',
      netRevenue: true,
      requestId: 12345,
      width: '300',
      mediaType: BANNER,
      ttl: 60,
      meta: expectedMetaData
    };

    it('should get correct bid response', function () {
      expect(spec.interpretResponse({ body: serverResponse }, bidRequest)).to.deep.equal([expectedResponse]);
    });

    it('should set a default value for advertiserDomains if adomain is not found', function () {
      const meta = { ...metaData };
      delete meta.adomain;

      const response = { ...serverResponse, meta };
      const expectedMeta = { ...expectedMetaData, advertiserDomains: [] };
      const expected = { ...expectedResponse, meta: expectedMeta };

      expect(spec.interpretResponse({ body: response }, bidRequest)).to.deep.equal([expected]);
    });

    it('should set a default value for meta.mediaType if mediaType is not found in the response', function () {
      const meta = { ...metaData };
      delete meta.mediaType;
      const response = { ...serverResponse, meta };
      const expected = { ...expectedResponse };

      expect(spec.interpretResponse({ body: response }, bidRequest)).to.deep.equal([expected]);
    });

    it('should pass correct currency if found in bid response', function () {
      const cur = 'EURO';
      const response = { ...serverResponse };
      response.ad.cur = cur;

      const expected = { ...expectedResponse };
      expected.currency = cur;

      expect(spec.interpretResponse({ body: response }, bidRequest)).to.deep.equal([expected]);
    });

    it('handles nobid responses', function () {
      const response = {
        'ad': {},
        'pag': {
          't': 'ggumtest',
          'pvid': 'aa8bbb65-427f-4689-8cee-e3eed0b89eec',
          'css': 'html { overflow-y: auto }',
          'js': 'console.log("environment", env);'
        },
        'thms': 10000
      }
      const result = spec.interpretResponse({ body: response }, bidRequest);
      expect(result.length).to.equal(0);
    });

    it('handles empty response', function () {
      let body;
      const result = spec.interpretResponse({ body }, bidRequest);
      expect(result.length).to.equal(0);
    });

    describe('bidResponse width and height', function () {
      it('uses response maxw and maxh for when found in bidresponse', function () {
        const maxSlotAdResponse = { ...serverResponse.ad, maxw: 300, maxh: 600 };
        const result = spec.interpretResponse({ body: { ...serverResponse, ad: maxSlotAdResponse } }, bidRequest)[0];
        expect(result.width).to.equal(maxSlotAdResponse.maxw.toString());
        expect(result.height).to.equal(maxSlotAdResponse.maxh.toString());
      });

      it('returns 1x1 when eligible product and size are available', function () {
        const bidRequest = {
          id: 12346,
          sizes: [[300, 250], [1, 1]],
          url: ENDPOINT,
          method: 'GET',
          data: {
            pi: 5,
            t: 'ggumtest'
          }
        }
        const serverResponse = {
          'ad': {
            'id': 2065333,
            'height': 90,
            'ipd': 2000,
            'markup': '<html><h3>Hello</h3></html>',
            'ii': true,
            'du': null,
            'price': 1,
            'zi': 0,
            'impurl': 'http://g2.gumgum.com/ad/view',
            'clsurl': 'http://g2.gumgum.com/ad/close'
          },
          'pag': {
            't': 'ggumtest',
            'pvid': 'aa8bbb65-427f-4689-8cee-e3eed0b89eec',
          },
          'thms': 10000
        }
        const result = spec.interpretResponse({ body: serverResponse }, bidRequest);
        expect(result[0].width).to.equal('1');
        expect(result[0].height).to.equal('1');
      });

      it('uses request size that nearest matches response size for in-screen', function () {
        const request = { ...bidRequest };
        const body = { ...serverResponse };
        const expectedSize = [300, 50];
        let result;

        request.pi = 2;
        request.sizes.unshift(expectedSize);

        // typical ad server response values for in-screen
        body.ad.width = 300;
        body.ad.height = 100;

        result = spec.interpretResponse({ body }, request)[0];

        expect(result.width = expectedSize[0]);
        expect(result.height = expectedSize[1]);
      })

      it('request size that  matches response size for in-slot', function () {
        const request = { ...bidRequest };
        const body = { ...serverResponse };
        const expectedSize = [[ 320, 50 ], [300, 600], [300, 250]];
        let result;
        request.pi = 3;
        body.ad.width = 300;
        body.ad.height = 600;
        result = spec.interpretResponse({ body }, request)[0];
        expect(result.width = expectedSize[1][0]);
        expect(result.height = expectedSize[1][1]);
      })

      it('defaults to use bidRequest sizes', function () {
        const { ad, jcsi, pag, thms, meta } = serverResponse
        const noAdSizes = { ...ad }
        delete noAdSizes.width
        delete noAdSizes.height
        const responseWithoutSizes = { jcsi, pag, thms, meta, ad: noAdSizes }
        const request = { ...bidRequest, sizes: [[100, 200]] }
        const result = spec.interpretResponse({ body: responseWithoutSizes }, request)[0];

        expect(result.width).to.equal(request.sizes[0][0].toString())
        expect(result.height).to.equal(request.sizes[0][1].toString())
      });
    });

    it('updates jcsi object when the server response jcsi prop is found', function () {
      const response = Object.assign({ cw: 'AD_JSON' }, serverResponse);
      const bidResponse = spec.interpretResponse({ body: response }, bidRequest)[0].ad;
      const decodedResponse = JSON.parse(atob(bidResponse));
      expect(decodedResponse.jcsi).to.eql(JCSI);
    });

    it('sets the correct mediaType depending on product', function () {
      const bannerBidResponse = spec.interpretResponse({ body: serverResponse }, bidRequest)[0];
      const invideoBidResponse = spec.interpretResponse({ body: serverResponse }, { ...bidRequest, data: { pi: 6 } })[0];
      const videoBidResponse = spec.interpretResponse({ body: serverResponse }, { ...bidRequest, data: { pi: 7 } })[0];
      expect(bannerBidResponse.mediaType).to.equal(BANNER);
      expect(invideoBidResponse.mediaType).to.equal(VIDEO);
      expect(videoBidResponse.mediaType).to.equal(VIDEO);
    });

    it('sets a vastXml property if mediaType is video', function () {
      const videoBidResponse = spec.interpretResponse({ body: serverResponse }, { ...bidRequest, data: { pi: 7 } })[0];
      expect(videoBidResponse.vastXml).to.exist;
    });
  })
  describe('getUserSyncs', function () {
    const syncOptions = {
      'iframeEnabled': 'true'
    }
    const response = {
      'pxs': {
        'scr': [
          {
            't': 'i',
            'u': 'https://c.gumgum.com/images/pixel.gif'
          },
          {
            't': 'f',
            'u': 'https://www.nytimes.com/'
          }
        ]
      }
    }
    const result = spec.getUserSyncs(syncOptions, [{ body: response }]);
    expect(result[0].type).to.equal('image')
    expect(result[1].type).to.equal('iframe')
  })
});
