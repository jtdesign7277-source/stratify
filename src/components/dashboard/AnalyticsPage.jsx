import { useEffect, useRef } from 'react';
import Highcharts from 'highcharts/highstock';
import Dashboards from '@highcharts/dashboards';
import HighchartsConnectors from '@highcharts/dashboards/es-modules/Dashboards/Plugins/HighchartsPlugin';
import '@highcharts/dashboards/css/dashboards.css';

// Initialize Highcharts plugin
HighchartsConnectors.custom.connectHighcharts(Highcharts);
Dashboards.PluginHandler.addPlugin(HighchartsConnectors);

export default function AnalyticsPage() {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Morningstar credentials
    const commonMSOptions = {
      api: {
        url: 'https://demo-live-data.highcharts.com',
        access: {
          url: 'https://demo-live-data.highcharts.com/token/oauth',
          token: 'your-access-token'
        }
      }
    };

    const basicInvestmentPlan = {
      interval: 30,
      amount: 200
    };

    const stockCollection = [
      { tradingSymbol: 'NFLX', ISIN: 'US64110L1061', SecID: '0P000003UP' },
      { tradingSymbol: 'MSFT', ISIN: 'US5949181045', SecID: '0P000003MH' },
      { tradingSymbol: 'AMZN', ISIN: 'US0231351067', SecID: '0P000000B7' },
      { tradingSymbol: 'GOOGL', ISIN: 'US02079K3059', SecID: '0P000002HD' }
    ];

    const generatePortfolio = (investmentPlan, stockPrices) => {
      const { interval, amount } = investmentPlan;
      const holding = [];
      const investedAmount = [];
      let totalUnits = 0;
      let investedSoFar = 0;

      stockPrices.forEach((priceData, day) => {
        if ((day % interval) === 0) {
          totalUnits += amount / priceData[1];
          investedSoFar += amount;
        }
        const value = totalUnits * priceData[1];
        holding.push(value);
        investedAmount.push(investedSoFar);
      });

      return { holding, investedAmount };
    };

    const getHoldings = weight => stockCollection.map(stock => ({
      id: stock.ISIN,
      idType: 'ISIN',
      ...(weight && { weight })
    }));

    const getCurrentTotal = arrOfArr => {
      let sum = 0;
      arrOfArr.forEach(arr => {
        sum += arr.at(-1);
      });
      return sum;
    };

    (async () => {
      try {
        const timeSeriesConnector = new HighchartsConnectors.Morningstar.TimeSeriesConnector({
          ...commonMSOptions,
          series: { type: 'Price' },
          securities: getHoldings(),
          currencyId: 'EUR',
          startDate: '2022-01-01',
          endDate: '2023-12-31'
        });

        await timeSeriesConnector.load();

        const { Date: dates, ...companies } = timeSeriesConnector.getTable().getColumns();
        const processedData = Object.fromEntries(
          Object.entries(companies).map(([key, values]) => [
            key,
            values.map((value, i) => [dates[i], value])
          ])
        );

        const holdings = [];
        const investedAmounts = [];
        const gridData = [];

        stockCollection.forEach(stock => {
          const { holding, investedAmount } = generatePortfolio(
            basicInvestmentPlan,
            processedData[stock.SecID]
          );
          holdings.push(holding);
          investedAmounts.push(investedAmount);
        });

        const investedAmountTotal = getCurrentTotal(investedAmounts);
        const lastHoldingTotal = getCurrentTotal(holdings);
        const annualInvestment = 200 * 12 * holdings.length;

        stockCollection.forEach((stock, i) => {
          const len = holdings[i].length;
          const lastHolding = holdings[i][len - 1];
          gridData.push([
            stock.tradingSymbol,
            stock.ISIN,
            Math.round(lastHolding / lastHoldingTotal * 100)
          ]);
        });

        const portfolio = {
          name: 'PersonalPortfolio',
          currency: 'EUR',
          totalValue: lastHoldingTotal,
          holdings: getHoldings(100 / stockCollection.length)
        };

        Highcharts.setOptions({
          chart: { styledMode: false, backgroundColor: 'transparent' },
          lang: { rangeSelectorZoom: '' }
        });

        const board = await Dashboards.board(containerRef.current, {
          dataPool: {
            connectors: [
              {
                id: 'investment-data',
                type: 'JSON',
                data: [dates, ...investedAmounts],
                orientation: 'columns',
                firstRowAsNames: false,
                dataModifier: {
                  type: 'Math',
                  columnFormulas: [{
                    column: 'investmentAccumulation',
                    formula: '=SUM(B1:ZZ1)'
                  }]
                }
              },
              {
                id: 'holding-data',
                type: 'JSON',
                data: [dates, ...holdings],
                orientation: 'columns',
                firstRowAsNames: false,
                dataModifier: {
                  type: 'Math',
                  columnFormulas: [{
                    column: 'holdingAccumulation',
                    formula: '=SUM(B1:ZZ1)'
                  }]
                }
              },
              {
                id: 'stock-grid',
                type: 'JSON',
                columnIds: ['Name', 'ISIN', 'Percentage'],
                firstRowAsNames: false,
                data: gridData
              }
            ]
          },
          gui: {
            layouts: [{
              rows: [
                {
                  cells: [{
                    id: 'kpi-wrapper',
                    layout: {
                      rows: [{
                        cells: [{ id: 'kpi-holding' }, { id: 'kpi-invested' }]
                      }]
                    }
                  }]
                },
                { cells: [{ id: 'wallet-chart' }] },
                { cells: [{ id: 'grid' }] }
              ]
            }]
          },
          components: [
            {
              type: 'KPI',
              renderTo: 'kpi-holding',
              value: lastHoldingTotal,
              valueFormat: '€{value:,.2f}',
              title: 'Holding'
            },
            {
              type: 'KPI',
              renderTo: 'kpi-invested',
              value: investedAmountTotal,
              valueFormat: '€{value:,.2f}',
              title: 'Invested'
            },
            {
              type: 'Highcharts',
              chartConstructor: 'stockChart',
              renderTo: 'wallet-chart',
              connector: [
                {
                  id: 'holding-data',
                  columnAssignment: [{
                    seriesId: 'holding',
                    data: ['0', 'holdingAccumulation']
                  }]
                },
                {
                  id: 'investment-data',
                  columnAssignment: [{
                    seriesId: 'invested',
                    data: ['0', 'investmentAccumulation']
                  }]
                }
              ],
              chartOptions: {
                chart: { height: 400, backgroundColor: 'transparent' },
                rangeSelector: { inputEnabled: false, selected: 4 },
                navigator: { enabled: false },
                title: { text: 'Portfolio Performance', style: { color: '#fff' } },
                series: [
                  { name: 'Holding', id: 'holding', color: '#10b981' },
                  { name: 'Invested', id: 'invested', color: '#3b82f6', dashStyle: 'Dot' }
                ]
              }
            },
            {
              type: 'DataGrid',
              connector: { id: 'stock-grid' },
              renderTo: 'grid'
            }
          ]
        });
      } catch (error) {
        console.error('Analytics dashboard error:', error);
      }
    })();

    return () => {
      // Cleanup
    };
  }, []);

  return (
    <div className="h-full w-full bg-transparent p-6">
      <div ref={containerRef} id="container" className="h-full w-full" />
    </div>
  );
}
