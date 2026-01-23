import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface AdminChartsProps {
  stats: {
    freeUsers: number;
    proUsers: number;
    scholarUsers: number;
  };
  userGrowthData: { date: string; signups: number }[];
  revenueData: { date: string; revenue: number }[];
  activityStats: {
    documentCount: number;
    chatCount: number;
    analysisCount: number;
    paraphraseCount: number;
  } | null;
}

const COLORS = ['hsl(var(--muted-foreground))', 'hsl(var(--primary))', 'hsl(var(--accent))'];

export const AdminCharts = ({ stats, userGrowthData, revenueData, activityStats }: AdminChartsProps) => {
  const planData = [
    { name: 'Free', value: stats.freeUsers, color: 'hsl(var(--muted-foreground))' },
    { name: 'Pro', value: stats.proUsers, color: 'hsl(var(--primary))' },
    { name: 'Scholar', value: stats.scholarUsers, color: 'hsl(var(--accent))' },
  ].filter(d => d.value > 0);

  const featureData = activityStats ? [
    { name: 'Documents', count: activityStats.documentCount },
    { name: 'Chats', count: activityStats.chatCount },
    { name: 'Analyses', count: activityStats.analysisCount },
    { name: 'Paraphrases', count: activityStats.paraphraseCount },
  ] : [];

  // Format dates for display
  const formattedGrowthData = userGrowthData.map(d => ({
    ...d,
    displayDate: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }));

  const formattedRevenueData = revenueData.map(d => ({
    ...d,
    displayDate: new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }));

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* User Growth Chart */}
      <Card className="shadow-md rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">User Growth (30 days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            {formattedGrowthData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={formattedGrowthData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis 
                    dataKey="displayDate" 
                    tick={{ fontSize: 10 }} 
                    className="text-muted-foreground"
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="signups" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No signup data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Revenue Chart */}
      <Card className="shadow-md rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Revenue (30 days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            {formattedRevenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={formattedRevenueData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis 
                    dataKey="displayDate" 
                    tick={{ fontSize: 10 }} 
                    className="text-muted-foreground"
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    tick={{ fontSize: 10 }} 
                    className="text-muted-foreground"
                    tickFormatter={(value) => `₦${(value / 1000).toFixed(0)}k`}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                    formatter={(value: number) => [`₦${value.toLocaleString()}`, 'Revenue']}
                  />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No revenue data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Plan Distribution */}
      <Card className="shadow-md rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Plan Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            {planData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={planData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {planData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No user data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Feature Usage */}
      <Card className="shadow-md rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base">Feature Usage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            {featureData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={featureData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis type="number" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    tick={{ fontSize: 12 }} 
                    className="text-muted-foreground"
                    width={80}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                No activity data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
