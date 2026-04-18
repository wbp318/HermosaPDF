# PDF to Pretty

## Description
PDF to Pretty is a Python-based tool that enhances the visual appeal of PDF documents. It adds colorful backgrounds, improves text formatting, and creates a more aesthetically pleasing version of your original PDF.

## Features
- Adds a light blue background to each page
- Applies a blue border around the content
- Renders text in navy color with improved formatting
- Removes line numbers from the original PDF (if present)
- Preserves all original content while enhancing visual appeal

## Requirements
- Python 3.7+
- PyMuPDF (fitz)
- reportlab

## Installation
1. Clone this repository:
   ```
   git clone https://github.com/wbp318/pdf_to_pretty.git
   cd pdf_to_pretty
   ```
2. Create and activate a virtual environment:
   ```
   python -m venv venv
   .\venv\Scripts\Activate  # On Windows
   source venv/bin/activate  # On macOS/Linux
   ```
3. Install required packages:
   ```
   pip install PyMuPDF reportlab
   ```

## Usage
1. Place your input PDF in the project directory.
2. Run the script:
   ```
   python pdf_to_pretty.py
   ```
3. Find the enhanced PDF in the project directory as 'enhanced_output.pdf'.

## Contributing
Contributions, issues, and feature requests are welcome. Feel free to check issues page if you want to contribute.

## License
[MIT](https://choosealicense.com/licenses/mit/)