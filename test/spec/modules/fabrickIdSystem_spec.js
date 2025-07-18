import * as utils from '../../../src/utils.js';
import {server} from '../../mocks/xhr.js';

import {fabrickIdSubmodule, appendUrl} from 'modules/fabrickIdSystem.js';

const defaultConfigParams = {
  apiKey: '123',
  e: 'abc',
  p: ['def', 'hij'],
  url: 'http://localhost:9999/test/mocks/fabrickId.json?'
};
const responseHeader = {'Content-Type': 'application/json'}

describe('Fabrick ID System', function() {
  let logErrorStub;
  let sandbox;

  beforeEach(function () {
    sandbox = sinon.createSandbox();
    logErrorStub = sandbox.stub(utils, 'logError');
  });

  afterEach(function () {
    sandbox.restore();
  });

  it('should log an error if no configParams were passed into getId', function () {
    fabrickIdSubmodule.getId();
    expect(logErrorStub.calledOnce).to.be.true;
  });

  it('should error on json parsing', function() {
    const submoduleCallback = fabrickIdSubmodule.getId({
      name: 'fabrickId',
      params: defaultConfigParams
    }).callback;
    const callBackSpy = sinon.spy();
    submoduleCallback(callBackSpy);
    const request = server.requests[0];
    request.respond(
      200,
      responseHeader,
      '] this is not json {'
    );
    expect(callBackSpy.calledOnce).to.be.true;
    expect(logErrorStub.calledOnce).to.be.true;
  });

  it('should truncate the params', function() {
    let r = '';
    for (let i = 0; i < 1500; i++) {
      r += 'r';
    }
    const configParams = Object.assign({}, defaultConfigParams, {
      refererInfo: {
        topmostLocation: r,
        stack: ['s-0'],
        canonicalUrl: 'cu-0'
      }
    });
    const submoduleCallback = fabrickIdSubmodule.getId({
      name: 'fabrickId',
      params: configParams
    }).callback;
    const callBackSpy = sinon.spy();
    submoduleCallback(callBackSpy);
    const request = server.requests[0];
    r = '';
    for (let i = 0; i < 1000 - 3; i++) {
      r += 'r';
    }
    expect(request.url).to.match(new RegExp(`r=${r}&r=`));
    request.respond(
      200,
      responseHeader,
      JSON.stringify({})
    );
    expect(callBackSpy.calledOnce).to.be.true;
  });

  it('should complete successfully', function() {
    const configParams = Object.assign({}, defaultConfigParams, {
      refererInfo: {
        topmostLocation: 'r-0',
        stack: ['s-0'],
        canonicalUrl: 'cu-0'
      }
    });
    const submoduleCallback = fabrickIdSubmodule.getId({
      name: 'fabrickId',
      params: configParams
    }).callback;
    const callBackSpy = sinon.spy();
    submoduleCallback(callBackSpy);
    const request = server.requests[0];
    expect(request.url).to.match(/r=r-0&r=s-0&r=cu-0&r=http/);
    request.respond(
      200,
      responseHeader,
      JSON.stringify({})
    );
    expect(callBackSpy.calledOnce).to.be.true;
  });

  it('should truncate 2', function() {
    const configParams = {
      maxUrlLen: 10,
      maxRefLen: 5,
      maxSpaceAvailable: 2
    };

    let url = appendUrl('', 'r', '123', configParams);
    expect(url).to.equal('&r=12');

    url = appendUrl('12345', 'r', '678', configParams);
    expect(url).to.equal('12345&r=67');

    url = appendUrl('12345678', 'r', '9', configParams);
    expect(url).to.equal('12345678');

    configParams.maxRefLen = 8;
    url = appendUrl('', 'r', '1234&', configParams);
    expect(url).to.equal('&r=1234');

    url = appendUrl('', 'r', '123&', configParams);
    expect(url).to.equal('&r=123');

    url = appendUrl('', 'r', '12&', configParams);
    expect(url).to.equal('&r=12%26');

    url = appendUrl('', 'r', '1&&', configParams);
    expect(url).to.equal('&r=1%26');
  });
});
