import { Skeleton } from "@/components/ui/skeleton";
import { TableRow, TableCell } from "@/components/ui/table";

interface TableRowSkeletonProps {
  columns: number;
  rows?: number;
}

export const TableRowSkeleton = ({ columns, rows = 5 }: TableRowSkeletonProps) => {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <TableRow key={rowIndex}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <TableCell key={colIndex}>
              <Skeleton 
                className={`h-4 ${
                  colIndex === 0 ? 'w-32' : 
                  colIndex === columns - 1 ? 'w-20' : 
                  'w-24'
                }`} 
              />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
};