import openpyxl
import json

def read_excel_meta(filename):
    try:
        wb = openpyxl.load_workbook(filename, data_only=True)
        sheet = wb.active
        cols = [cell.value for cell in sheet[1]]
        
        rows = []
        for row in sheet.iter_rows(min_row=2, max_row=10, values_only=True):
            rows.append(list(row))
            
        return {
            "columns": cols,
            "sample_rows": rows
        }
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    result = read_excel_meta("Reportes de Vacaciones-2026-04-30.xlsx")
    print(json.dumps(result, indent=2, default=str))
