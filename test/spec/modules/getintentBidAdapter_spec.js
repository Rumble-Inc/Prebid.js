import { expect } from 'chai'
import { spec } from 'modules/getintentBidAdapter.js'
import {deepClone} from 'src/utils';

describe('GetIntent Adapter Tests:', function () {
  const bidRequests = [{
    bidId: 'bid12345',
    params: {
      pid: 'p1000',
      tid: 't1000'
    },
    sizes: [[300, 250]]
  },
  {
    bidId: 'bid54321',
    params: {
      pid: 'p1000',
      tid: 't1000'
    },
    sizes: [[50, 50], [100, 100]]
  }];
  const videoBidRequest = {
    mediaTypes: {
      video: {
        protocols: [1, 2, 3],
        mimes: ['video/mp4'],
        minduration: 5,
        maxduration: 30,
        minbitrate: 500,
        maxbitrate: 1000,
        api: [2],
        skip: 1
      }
    },
    bidId: 'bid789',
    params: {
      pid: 'p1001',
      tid: 't1001',
    },
    sizes: [300, 250],
    mediaType: 'video'
  };
  const videoBidRequestWithVideoParams = {
    mediaTypes: {
      video: {
        protocols: [1, 2, 3],
        mimes: ['video/mp4'],
        minduration: 5,
        maxduration: 30,
        minbitrate: 500,
        maxbitrate: 1000,
        api: [2],
        skip: 0
      }
    },
    bidId: 'bid789',
    params: {
      pid: 'p1001',
      tid: 't1001',
      video: {
        mimes: ['video/mp4', 'application/javascript'],
        max_dur: 20,
        api: [1, 2],
        skippable: 'ALLOW'
      }
    },
    sizes: [300, 250],
    mediaType: 'video'
  };

  it('Verify build request', function () {
    const serverRequests = spec.buildRequests(bidRequests);
    let serverRequest = serverRequests[0];
    expect(serverRequest.url).to.equal('https://px.adhigh.net/rtb/direct_banner');
    expect(serverRequest.method).to.equal('GET');
    expect(serverRequest.data.bid_id).to.equal('bid12345');
    expect(serverRequest.data.pid).to.equal('p1000');
    expect(serverRequest.data.tid).to.equal('t1000');
    expect(serverRequest.data.size).to.equal('300x250');
    expect(serverRequest.data.is_video).to.equal(false);
    serverRequest = serverRequests[1];
    expect(serverRequest.data.size).to.equal('50x50,100x100');
  });

  it('Verify build video request', function () {
    const serverRequests = spec.buildRequests([videoBidRequest]);
    const serverRequest = serverRequests[0];
    expect(serverRequest.url).to.equal('https://px.adhigh.net/rtb/direct_vast');
    expect(serverRequest.method).to.equal('GET');
    expect(serverRequest.data.bid_id).to.equal('bid789');
    expect(serverRequest.data.pid).to.equal('p1001');
    expect(serverRequest.data.tid).to.equal('t1001');
    expect(serverRequest.data.size).to.equal('300x250');
    expect(serverRequest.data.is_video).to.equal(true);
    expect(serverRequest.data.protocols).to.equal('1,2,3');
    expect(serverRequest.data.mimes).to.equal('video/mp4');
    expect(serverRequest.data.min_dur).to.equal(5);
    expect(serverRequest.data.max_dur).to.equal(30);
    expect(serverRequest.data.min_btr).to.equal(500);
    expect(serverRequest.data.max_btr).to.equal(1000);
    expect(serverRequest.data.api).to.equal('2');
    expect(serverRequest.data.skippable).to.equal('ALLOW');
  });

  it('Verify build video request with video params', function () {
    const serverRequests = spec.buildRequests([videoBidRequestWithVideoParams]);
    const serverRequest = serverRequests[0];
    expect(serverRequest.url).to.equal('https://px.adhigh.net/rtb/direct_vast');
    expect(serverRequest.method).to.equal('GET');
    expect(serverRequest.data.bid_id).to.equal('bid789');
    expect(serverRequest.data.pid).to.equal('p1001');
    expect(serverRequest.data.tid).to.equal('t1001');
    expect(serverRequest.data.size).to.equal('300x250');
    expect(serverRequest.data.is_video).to.equal(true);
    expect(serverRequest.data.mimes).to.equal('video/mp4,application/javascript');
    expect(serverRequest.data.max_dur).to.equal(20);
    expect(serverRequest.data.api).to.equal('1,2');
    expect(serverRequest.data.skippable).to.equal('ALLOW');
  });

  it('Verify bid floor without price floors module', function() {
    const bidRequestWithFloor = deepClone(bidRequests[0]);
    bidRequestWithFloor.params.floor = 10
    bidRequestWithFloor.params.cur = 'USD'

    const serverRequests = spec.buildRequests([bidRequestWithFloor]);
    const serverRequest = serverRequests[0];
    expect(serverRequest.data.cur).to.equal('USD');
    expect(serverRequest.data.floor).to.equal(10);
  });

  it('Verify bid floor with price floors module', function() {
    const bidRequestWithFloor = deepClone(bidRequests[0]);
    bidRequestWithFloor.params.floor = 10
    bidRequestWithFloor.params.cur = 'USD'
    const getFloorResponse = {floor: 5, currency: 'EUR'};
    bidRequestWithFloor.getFloor = () => getFloorResponse;

    const serverRequests = spec.buildRequests([bidRequestWithFloor]);
    const serverRequest = serverRequests[0];
    expect(serverRequest.data.cur).to.equal('EUR');
    expect(serverRequest.data.floor).to.equal(5);
  });

  it('Verify parse response', function () {
    const serverResponse = {
      body: {
        bid_id: 'bid12345',
        cpm: 2.25,
        currency: 'USD',
        size: '300x250',
        creative_id: '1000',
        ad: 'Ad markup'
      },
      headers: {
      }
    };
    const bids = spec.interpretResponse(serverResponse);
    expect(bids).to.have.lengthOf(1);
    const bid = bids[0];
    expect(bid.cpm).to.equal(2.25);
    expect(bid.currency).to.equal('USD');
    expect(bid.creativeId).to.equal('1000');
    expect(bid.width).to.equal(300);
    expect(bid.height).to.equal(250);
    expect(bid.requestId).to.equal('bid12345');
    expect(bid.mediaType).to.equal('banner');
    expect(bid.ad).to.equal('Ad markup');
  });

  it('Verify parse video response', function () {
    const serverResponse = {
      body: {
        bid_id: 'bid789',
        cpm: 3.25,
        currency: 'USD',
        size: '300x250',
        creative_id: '2000',
        vast_url: 'https://vast.xml/url'
      },
      headers: {
      }
    };
    const bids = spec.interpretResponse(serverResponse);
    expect(bids).to.have.lengthOf(1);
    const bid = bids[0];
    expect(bid.cpm).to.equal(3.25);
    expect(bid.currency).to.equal('USD');
    expect(bid.creativeId).to.equal('2000');
    expect(bid.width).to.equal(300);
    expect(bid.height).to.equal(250);
    expect(bid.requestId).to.equal('bid789');
    expect(bid.mediaType).to.equal('video');
    expect(bid.vastUrl).to.equal('https://vast.xml/url');
  });

  it('Verify bidder code', function () {
    expect(spec.code).to.equal('getintent');
  });

  it('Verify bidder aliases', function () {
    expect(spec.aliases).to.have.lengthOf(1);
    expect(spec.aliases[0]).to.equal('getintentAdapter');
  });

  it('Verify supported media types', function () {
    expect(spec.supportedMediaTypes).to.have.lengthOf(2);
    expect(spec.supportedMediaTypes[0]).to.equal('video');
    expect(spec.supportedMediaTypes[1]).to.equal('banner');
  });

  it('Verify if bid request valid', function () {
    expect(spec.isBidRequestValid(bidRequests[0])).to.equal(true);
    expect(spec.isBidRequestValid(bidRequests[1])).to.equal(true);
    expect(spec.isBidRequestValid({})).to.equal(false);
    expect(spec.isBidRequestValid({ params: {} })).to.equal(false);
    expect(spec.isBidRequestValid({ params: { test: 123 } })).to.equal(false);
    expect(spec.isBidRequestValid({ params: { pid: 111, tid: 222 } })).to.equal(true);
  });
});
