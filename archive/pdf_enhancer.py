import fitz  # PyMuPDF
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import Paragraph, Frame
from io import BytesIO

def enhance_pdf(input_path, output_path):
    # Open the input PDF
    doc = fitz.open(input_path)
    
    # Create a new PDF
    packet = BytesIO()
    can = canvas.Canvas(packet, pagesize=letter)
    width, height = letter

    styles = getSampleStyleSheet()
    custom_style = ParagraphStyle('CustomStyle', parent=styles['Normal'],
                                  fontName='Helvetica',
                                  fontSize=12,
                                  leading=14,
                                  textColor=colors.navy)

    for page_num in range(len(doc)):
        page = doc.load_page(page_num)
        text = page.get_text("text")
        
        # Remove line numbers (assuming they're at the start of each line)
        cleaned_text = '\n'.join([line.split(' ', 1)[-1] if line.strip() and line.split()[0].isdigit() else line for line in text.split('\n')])

        # Add a colored background
        can.setFillColor(colors.lightblue)
        can.rect(0, 0, width, height, fill=1)

        # Add a border
        can.setStrokeColor(colors.blue)
        can.setLineWidth(5)
        can.rect(20, 20, width-40, height-40, fill=0)

        # Add the text
        frame = Frame(30, 30, width-60, height-60, showBoundary=0)
        story = [Paragraph(cleaned_text.replace('\n', '<br/>'), custom_style)]
        frame.addFromList(story, can)

        can.showPage()

    can.save()

    # Move to the beginning of the BytesIO buffer
    packet.seek(0)
    
    # Save the enhanced PDF
    output_doc = fitz.open()
    output_doc.insert_pdf(fitz.open("pdf", packet.getvalue()))
    output_doc.save(output_path)
    output_doc.close()

# Usage
input_pdf = 'md_leadgen_convertpdf.pdf'
output_pdf = 'enhanced_output2.pdf'
enhance_pdf(input_pdf, output_pdf)