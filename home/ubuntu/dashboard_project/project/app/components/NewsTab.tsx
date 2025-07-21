'use client';

import { useState } from 'react';
import { Newspaper, TrendingUp, Clock, ExternalLink, Filter } from 'lucide-react';
import { useNews } from '../hooks/useRealTimeData';

const NewsTab = () => {
  const { news, isLoading } = useNews();
  const [newsFilter, setNewsFilter] = useState('all');

  const categories = [
    { id: 'all', label: 'All News', count: news.length },
    { id: 'earnings', label: 'Earnings', count: news.filter(n => n.category === 'earnings').length },
    { id: 'monetary-policy', label: 'Policy', count: news.filter(n => n.category === 'monetary-policy').length },
    { id: 'sector-news', label: 'Sector', count: news.filter(n => n.category === 'sector-news').length },
    { id: 'market-flows', label: 'Flows', count: news.filter(n => n.category === 'market-flows').length }
  ];

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'positive': return 'text-green-600 bg-green-50';
      case 'negative': return 'text-red-600 bg-red-50';
      case 'neutral': return 'text-yellow-600 bg-yellow-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case 'positive': return '↗️';
      case 'negative': return '↘️';
      case 'neutral': return '➡️';
      default: return '📊';
    }
  };

  const filteredNews = newsFilter === 'all' 
    ? news 
    : news.filter(newsItem => newsItem.category === newsFilter);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 slide-in">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Market News & Analysis</h1>
        <p className="text-gray-600">Real-time financial news affecting Indian markets</p>
      </div>

      {/* News Categories Filter */}
      <div className="glass-effect rounded-xl p-4 shadow-lg">
        <div className="flex items-center space-x-2 mb-4">
          <Filter className="h-5 w-5 text-gray-600" />
          <span className="font-medium text-gray-900">Filter by Category</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setNewsFilter(category.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                newsFilter === category.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {category.label} ({category.count})
            </button>
          ))}
        </div>
      </div>

      {/* News Feed */}
      <div className="space-y-4">
        {filteredNews.length === 0 ? (
          <div className="glass-effect rounded-xl p-12 shadow-lg text-center">
            <Newspaper className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No News Available</h3>
            <p className="text-gray-600">Check back later for the latest market updates</p>
          </div>
        ) : (
          filteredNews.map((newsItem) => (
            <div key={newsItem.id} className="glass-effect rounded-xl p-6 shadow-lg hover:shadow-xl transition-all">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${getImpactColor(newsItem.impact)}`}>
                    {getImpactIcon(newsItem.impact)} {newsItem.impact.toUpperCase()}
                  </span>
                  <span className="text-sm text-gray-600 flex items-center">
                    <Clock className="h-4 w-4 mr-1" />
                    {new Date(newsItem.timestamp).toLocaleString()}
                  </span>
                </div>
                <span className="text-sm text-gray-500">{newsItem.source}</span>
              </div>

              <h3 className="text-lg font-semibold text-gray-900 mb-2 hover:text-blue-600 cursor-pointer">
                {newsItem.title}
              </h3>

              <p className="text-gray-700 mb-4">{newsItem.summary}</p>

              {newsItem.relevantStocks.length > 0 && (
                <div className="mb-4">
                  <span className="text-sm font-medium text-gray-600 mr-2">Relevant Stocks:</span>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {newsItem.relevantStocks.map((stock, index) => (
                      <span
                        key={index}
                        className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded"
                      >
                        {stock}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t border-gray-200 pt-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-start space-x-2">
                    <TrendingUp className="h-4 w-4 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Market Impact</p>
                      <p className="text-sm text-gray-600">
                        {newsItem.impact === 'positive' ? 'Positive sentiment expected' :
                         newsItem.impact === 'negative' ? 'Negative pressure anticipated' :
                         'Neutral market reaction expected'}
                      </p>
                    </div>
                  </div>
                  <button className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm font-medium">
                    <span>Read More</span>
                    <ExternalLink className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Market Sentiment Summary */}
      <div className="glass-effect rounded-xl p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <Newspaper className="h-5 w-5 mr-2 text-blue-600" />
          Market Sentiment Summary
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-2xl font-bold text-green-600">
              {news.filter(n => n.impact === 'positive').length}
            </p>
            <p className="text-sm text-green-700">Positive News</p>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-lg">
            <p className="text-2xl font-bold text-red-600">
              {news.filter(n => n.impact === 'negative').length}
            </p>
            <p className="text-sm text-red-700">Negative News</p>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <p className="text-2xl font-bold text-yellow-600">
              {news.filter(n => n.impact === 'neutral').length}
            </p>
            <p className="text-sm text-yellow-700">Neutral News</p>
          </div>
        </div>
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Overall Sentiment:</strong> {
              news.filter(n => n.impact === 'positive').length > news.filter(n => n.impact === 'negative').length
                ? 'Positive - Market showing optimism with supportive news flow'
                : news.filter(n => n.impact === 'negative').length > news.filter(n => n.impact === 'positive').length
                ? 'Negative - Cautious sentiment with challenging headwinds'
                : 'Mixed - Balanced news flow with stock-specific opportunities'
            }
          </p>
        </div>
      </div>

      {/* News Sources */}
      <div className="glass-effect rounded-xl p-6 shadow-lg">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Trusted News Sources</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {['Economic Times', 'Business Standard', 'Mint', 'Moneycontrol', 'CNBC TV18', 'Bloomberg Quint'].map((source, index) => (
            <div key={index} className="text-center p-3 border border-gray-200 rounded-lg hover:shadow-md transition-shadow">
              <p className="text-sm font-medium text-gray-900">{source}</p>
              <p className="text-xs text-green-600">Active</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NewsTab;