describe('toggle filters', function () {
  let _ = require('lodash');
  let expect = require('expect.js');
  let ngMock = require('ngMock');
  let sinon = require('auto-release-sinon');
  let MockState = require('fixtures/mock_state');
  let storeNames = {
    app: 'appState',
    global: 'globalState'
  };
  let filters;
  let queryFilter;
  let $rootScope;
  let appState;
  let globalState;

  let toggleRelationalPanelSpy;
  let isFilterOutdatedStub;

  beforeEach(ngMock.module(
    'kibana',
    'kibana/courier',
    'kibana/global_state',
    function ($provide) {
      $provide.service('courier', require('fixtures/mock_courier'));

      $provide.service('kibiState', function () {
        isFilterOutdatedStub = sinon.stub();
        toggleRelationalPanelSpy = sinon.spy();
        return new MockState({
          isFilterOutdated: isFilterOutdatedStub,
          toggleRelationalPanel: toggleRelationalPanelSpy,
          filters: []
        });
      });

      appState = new MockState({ filters: [] });
      $provide.service('getAppState', function () {
        return function () { return appState; };
      });

      globalState = new MockState({ filters: [] });
      $provide.service('globalState', function () {
        return globalState;
      });
    }
  ));

  beforeEach(ngMock.inject(function (_$rootScope_, Private) {
    $rootScope = _$rootScope_;
    queryFilter = Private(require('ui/filter_bar/query_filter'));
    filters = [
      {
        query: { match: { extension: { query: 'jpg', type: 'phrase' } } },
        meta: { negate: false, disabled: false }
      },
      {
        query: { match: { '@tags': { query: 'info', type: 'phrase' } } },
        meta: { negate: false, disabled: false }
      },
      {
        query: { match: { '_type': { query: 'nginx', type: 'phrase' } } },
        meta: { negate: false, disabled: false }
      }
    ];
  }));

  describe('toggling a filter', function () {
    describe('kibi', function () {
      it('should toggle the relational panel if join filter is present', function () {
        filters = [
          {
            join_set: {},
            meta: { negate: false, disabled: false }
          }
        ];
        appState.filters = filters;

        queryFilter.toggleFilter(filters[0]);
        expect(appState.filters[0].meta.disabled).to.be(true);
        expect(toggleRelationalPanelSpy.calledWith()).to.be(true);
      });

      it('should not toggle the filter if it is outdated', function () {
        const filter = {
          join_sequence: [],
          meta: { label: 'join', disabled: true }
        };

        isFilterOutdatedStub.returns(true);
        queryFilter.toggleFilter(filter);
        expect(filter.meta.disabled).to.be(true);
      });

      it('should toggle the filter if it is not outdated', function () {
        const filter = {
          join_sequence: [],
          meta: { label: 'join', disabled: true, version: 2 }
        };

        isFilterOutdatedStub.returns(false);
        queryFilter.toggleFilter(filter);
        expect(filter.meta.disabled).to.be(false);
      });
    });

    it('should toggle the disabled property in appState', function () {
      _.each(filters, function (filter) {
        expect(filter.meta.disabled).to.be(false);
        appState.filters.push(filter);
      });

      queryFilter.toggleFilter(filters[1]);
      expect(appState.filters[1].meta.disabled).to.be(true);
    });

    it('should toggle the disabled property in globalState', function () {
      _.each(filters, function (filter) {
        expect(filter.meta.disabled).to.be(false);
        globalState.filters.push(filter);
      });

      queryFilter.toggleFilter(filters[1]);
      expect(globalState.filters[1].meta.disabled).to.be(true);
    });

    it('should fire the update and fetch events', function () {
      let emitSpy = sinon.spy(queryFilter, 'emit');
      appState.filters = filters;
      $rootScope.$digest();

      queryFilter.toggleFilter(filters[1]);
      $rootScope.$digest();

      expect(emitSpy.callCount).to.be(2);
      expect(emitSpy.firstCall.args[0]).to.be('update');
      expect(emitSpy.secondCall.args[0]).to.be('fetch');
    });

    it('should always enable the filter', function () {
      appState.filters = filters.map(function (filter) {
        filter.meta.disabled = true;
        return filter;
      });

      expect(appState.filters[1].meta.disabled).to.be(true);
      queryFilter.toggleFilter(filters[1], false);
      expect(appState.filters[1].meta.disabled).to.be(false);
      queryFilter.toggleFilter(filters[1], false);
      expect(appState.filters[1].meta.disabled).to.be(false);
    });

    it('should always disable the filter', function () {
      globalState.filters = filters;

      expect(globalState.filters[1].meta.disabled).to.be(false);
      queryFilter.toggleFilter(filters[1], true);
      expect(globalState.filters[1].meta.disabled).to.be(true);
      queryFilter.toggleFilter(filters[1], true);
      expect(globalState.filters[1].meta.disabled).to.be(true);
    });

    it('should work without appState', function () {
      appState = undefined;
      globalState.filters = filters;

      expect(globalState.filters[1].meta.disabled).to.be(false);
      expect(queryFilter.getFilters()).to.have.length(3);
      queryFilter.toggleFilter(filters[1]);
      expect(globalState.filters[1].meta.disabled).to.be(true);
    });
  });

  describe('bulk toggling', function () {
    beforeEach(function () {
      appState.filters = filters;
      globalState.filters = _.map(_.cloneDeep(filters), function (filter) {
        filter.meta.disabled = true;
        return filter;
      });
    });

    it('should swap the enabled state for all filters', function () {
      queryFilter.toggleAll();
      _.each(appState.filters, function (filter) {
        expect(filter.meta.disabled).to.be(true);
      });
      _.each(globalState.filters, function (filter) {
        expect(filter.meta.disabled).to.be(false);
      });
    });

    it('should enable all filters', function () {
      queryFilter.toggleAll(true);
      _.each(appState.filters, function (filter) {
        expect(filter.meta.disabled).to.be(true);
      });
      _.each(globalState.filters, function (filter) {
        expect(filter.meta.disabled).to.be(true);
      });
    });

    it('should disable all filters', function () {
      queryFilter.toggleAll(false);
      _.each(appState.filters, function (filter) {
        expect(filter.meta.disabled).to.be(false);
      });
      _.each(globalState.filters, function (filter) {
        expect(filter.meta.disabled).to.be(false);
      });
    });

    it('should work without appState', function () {
      appState = undefined;
      globalState.filters = filters;

      _.each(globalState.filters, function (filter) {
        expect(filter.meta.disabled).to.be(false);
      });

      queryFilter.toggleAll();

      _.each(globalState.filters, function (filter) {
        expect(filter.meta.disabled).to.be(true);
      });
    });
  });
});
