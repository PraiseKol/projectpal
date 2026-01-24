import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ArrowLeft, ArrowRight, FileSpreadsheet } from "lucide-react";
import { TutorialTrigger } from "@/components/Tutorial";
import type { ColumnConfig } from "@/pages/DataAnalysis";

interface DataPreviewStepProps {
  columns: ColumnConfig[];
  rawData: any[];
  fileName: string;
  onBack: () => void;
  onContinue: (columns: ColumnConfig[]) => void;
}

export const DataPreviewStep = ({
  columns: initialColumns,
  rawData,
  fileName,
  onBack,
  onContinue,
}: DataPreviewStepProps) => {
  const [columns, setColumns] = useState<ColumnConfig[]>(initialColumns);

  const updateColumn = (index: number, updates: Partial<ColumnConfig>) => {
    setColumns(prev => prev.map((col, i) => 
      i === index ? { ...col, ...updates } : col
    ));
  };

  const toggleIncluded = (index: number) => {
    updateColumn(index, { included: !columns[index].included });
  };

  const setColumnType = (index: number, type: ColumnConfig['type']) => {
    updateColumn(index, { type });
  };

  const includedCount = columns.filter(c => c.included).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5" />
                {fileName}
              </CardTitle>
              <CardDescription>
                {rawData.length} rows • {columns.length} columns • {includedCount} selected
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onBack}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <TutorialTrigger id="tutorial-continue-btn">
                <Button 
                  onClick={() => onContinue(columns)}
                  disabled={includedCount < 2}
                >
                  Continue
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </TutorialTrigger>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Column Configuration */}
          <TutorialTrigger id="tutorial-column-table">
            <div className="mb-6">
              <h3 className="font-semibold mb-3">Configure Columns</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Select which columns to include and verify their data types. You need at least 2 columns for analysis.
              </p>
              
              <ScrollArea className="h-[300px] border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <TutorialTrigger id="tutorial-include-checkbox">
                          <span>Include</span>
                        </TutorialTrigger>
                      </TableHead>
                      <TableHead>Column Name</TableHead>
                      <TableHead className="w-40">
                        <TutorialTrigger id="tutorial-type-selector">
                          <span>Data Type</span>
                        </TutorialTrigger>
                      </TableHead>
                      <TableHead>Sample Values</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {columns.map((col, index) => (
                      <TableRow key={index} className={!col.included ? 'opacity-50' : ''}>
                        <TableCell>
                          <Checkbox
                            checked={col.included}
                            onCheckedChange={() => toggleIncluded(index)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">{col.name}</TableCell>
                        <TableCell>
                          <Select
                            value={col.type}
                            onValueChange={(value) => setColumnType(index, value as ColumnConfig['type'])}
                            disabled={!col.included}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="numeric">Numeric</SelectItem>
                              <SelectItem value="likert">Likert Scale</SelectItem>
                              <SelectItem value="categorical">Categorical</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {col.sampleValues.slice(0, 3).map((val, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {String(val).substring(0, 15)}{String(val).length > 15 ? '...' : ''}
                              </Badge>
                            ))}
                            {col.sampleValues.length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{col.sampleValues.length - 3}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </TutorialTrigger>

          {/* Data Preview */}
          <div>
            <h3 className="font-semibold mb-3">Data Preview (First 10 Rows)</h3>
            <ScrollArea className="h-[250px] border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    {columns.filter(c => c.included).map((col, i) => (
                      <TableHead key={i}>{col.name}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rawData.slice(0, 10).map((row, rowIndex) => (
                    <TableRow key={rowIndex}>
                      <TableCell className="text-muted-foreground">{rowIndex + 1}</TableCell>
                      {columns.filter(c => c.included).map((col, colIndex) => (
                        <TableCell key={colIndex}>
                          {row[col.index] !== undefined ? String(row[col.index]) : '-'}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>

      {/* Tips Card */}
      <Card className="bg-muted/50">
        <CardContent className="py-4">
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium text-primary">Numeric:</span>
              <p className="text-muted-foreground">Continuous numbers like age, scores, counts</p>
            </div>
            <div>
              <span className="font-medium text-primary">Likert Scale:</span>
              <p className="text-muted-foreground">Rating scales (1-5, 1-7) for agreement/satisfaction</p>
            </div>
            <div>
              <span className="font-medium text-primary">Categorical:</span>
              <p className="text-muted-foreground">Groups/categories like gender, department, yes/no</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
