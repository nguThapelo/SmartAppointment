import React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

export interface TableColumn {
  field: string;
  headerName: string;
  format?: (value: any) => string;
}

interface DynamicTableProps {
  columns: TableColumn[];
  data: any[];
}

const DynamicTable: React.FC<DynamicTableProps> = ({ columns, data }) => (
  <Table>
    <TableHead>
      <TableRow>
        {columns.map(col => (
          <TableCell key={col.field} sx={{ fontWeight: "bold", color: "#0077c2" }}>
            {col.headerName}
          </TableCell>
        ))}
      </TableRow>
    </TableHead>
    <TableBody>
      {data.length === 0 ? (
        <TableRow>
          <TableCell colSpan={columns.length}>
            <Typography align="center" color="textSecondary">
              No data found.
            </Typography>
          </TableCell>
        </TableRow>
      ) : (
        data.map((row, idx) => (
          <TableRow key={row.id || idx}>
            {columns.map(col => (
              <TableCell key={col.field}>
                {col.format ? col.format(row[col.field]) : row[col.field]}
              </TableCell>
            ))}
          </TableRow>
        ))
      )}
    </TableBody>
  </Table>
);

export default DynamicTable;