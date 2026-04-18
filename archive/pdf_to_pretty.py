from fpdf import FPDF
import re

class PDF(FPDF):
    def header(self):
        self.set_font('Arial', 'B', 15)
        self.set_fill_color(200, 220, 255)
        self.cell(0, 10, 'Hypothetical Electoral Scenario for Robert F. Kennedy Jr.', 0, 1, 'C', 1)
        self.ln(10)

    def footer(self):
        self.set_y(-15)
        self.set_font('Arial', 'I', 8)
        self.cell(0, 10, f'Page {self.page_no()}', 0, 0, 'C')

def create_professional_pdf(content, output_file):
    pdf = PDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)

    # Remove line numbers and leading hashtags
    lines = content.split('\n')
    lines = [re.sub(r'^\d+\s*', '', line) for line in lines]
    lines = [re.sub(r'^#+\s*', '', line) for line in lines]

    section_colors = {
        'Overview': (255, 200, 200),
        'Methodology': (200, 255, 200),
        'Step-by-Step Analysis': (200, 200, 255),
        'Strategy': (255, 255, 200),
        'Conclusion': (255, 200, 255)
    }

    pdf.set_font('Arial', 'B', 14)
    pdf.set_text_color(0, 0, 0)

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # Replace problematic characters
        line = line.replace("'", "'").replace(""", '"').replace(""", '"')

        if line in section_colors:
            pdf.set_fill_color(*section_colors[line])
            pdf.cell(0, 10, line, 0, 1, 'L', 1)
            pdf.ln(5)
        elif line.startswith(('1.', '2.', '3.', '4.')):
            pdf.set_font('Arial', 'B', 12)
            pdf.cell(0, 8, line, 0, 1)
            pdf.set_font('Arial', '', 12)
        elif line.startswith('-'):
            pdf.set_font('Arial', '', 12)
            pdf.cell(10, 7, chr(149), 0, 0)  # Unicode bullet point
            pdf.multi_cell(0, 7, line[1:].strip())
        else:
            pdf.set_font('Arial', '', 12)
            pdf.multi_cell(0, 7, line)
        
        if line.startswith(('Overview', 'Methodology', 'Step-by-Step Analysis', 'Strategy', 'Conclusion')):
            pdf.ln(5)

    pdf.output(output_file)

# Complete content
content = """
Hypothetical Electoral Scenario for Robert F. Kennedy Jr.

Overview
This document outlines a hypothetical electoral strategy for Robert F. Kennedy Jr. to secure 270 electoral votes, focusing on states where he is currently eligible.

Methodology

1. Identify Key States and Their Electoral Votes
2. Target Major Metropolitan Areas
3. Identify Significant Counties in Each State
4. Calculate the Electoral Votes

Step-by-Step Analysis

1. Key States and Electoral Votes

(List of states and their electoral votes, as provided in the original text)

2. Major Metropolitan Areas

Larger States:
- California: Los Angeles, San Francisco, San Diego
- Texas: Houston, Dallas, San Antonio, Austin
- Florida: Miami, Orlando, Tampa
- New York: New York City, Buffalo
- Illinois: Chicago
- Pennsylvania: Philadelphia, Pittsburgh
- Ohio: Cleveland, Columbus, Cincinnati
- Michigan: Detroit, Grand Rapids
- Georgia: Atlanta
- North Carolina: Charlotte, Raleigh
- New Jersey: Newark, Jersey City
- Virginia: Virginia Beach, Richmond

Smaller States:
1. Alabama (9): Birmingham, Montgomery, Mobile, Huntsville, Tuscaloosa
2. Arkansas (6): Little Rock, Fort Smith, Fayetteville, Springdale, Jonesboro
3. Connecticut (7): Bridgeport, New Haven, Stamford, Hartford, Waterbury
4. Delaware (3): Wilmington, Dover, Newark
5. Hawaii (4): Honolulu, Hilo, Kailua, Kapolei
6. Idaho (4): Boise, Meridian, Nampa, Idaho Falls, Pocatello
7. Iowa (6): Des Moines, Cedar Rapids, Davenport, Sioux City, Iowa City
8. Kansas (6): Wichita, Overland Park, Kansas City, Olathe, Topeka
9. Louisiana (8): New Orleans, Baton Rouge, Shreveport, Lafayette, Alexandria, Monroe
10. Maine (4): Portland, Lewiston, Bangor, South Portland, Auburn
11. Mississippi (6): Jackson, Gulfport, Southaven, Biloxi, Hattiesburg
12. Montana (3): Billings, Missoula, Great Falls, Bozeman, Butte
13. Nebraska (5): Omaha, Lincoln, Bellevue, Grand Island, Kearney
14. Nevada (6): Las Vegas, Henderson, Reno, North Las Vegas, Sparks
15. New Hampshire (4): Manchester, Nashua, Concord, Derry, Dover
16. New Mexico (5): Albuquerque, Las Cruces, Rio Rancho, Santa Fe, Roswell
17. North Dakota (3): Fargo, Bismarck, Grand Forks, Minot, West Fargo
18. Rhode Island (4): Providence, Warwick, Cranston, Pawtucket, East Providence
19. South Dakota (3): Sioux Falls, Rapid City, Aberdeen, Brookings, Watertown
20. Utah (6): Salt Lake City, West Valley City, Provo, West Jordan, Orem
21. Vermont (3): Burlington, South Burlington, Rutland, Barre, Montpelier
22. West Virginia (5): Charleston, Huntington, Morgantown, Parkersburg, Wheeling
23. Wyoming (3): Cheyenne, Casper, Laramie, Gillette, Rock Springs

3. Significant Counties

Consider influential counties within these states that can contribute to the electoral vote tally.

4. Electoral Vote Calculation

Example scenario to reach 270+ electoral votes:

- California (55)
- Texas (38)
- Florida (29)
- New York (29)
- Illinois (20)
- Pennsylvania (20)
- Ohio (18)
- Michigan (16)
- Georgia (16)
- North Carolina (15)
- New Jersey (14)
- Virginia (13)

Total from larger states: 283 electoral votes

Additional potential from smaller states:
- Alabama (9)
- Connecticut (7)
- Iowa (6)
- Kansas (6)
- Louisiana (8)
- Mississippi (6)
- Nevada (6)
- Utah (6)
- Arkansas (6)
- West Virginia (5)
- New Mexico (5)

Potential additional electoral votes: 70

Grand total potential: 353 electoral votes

Strategy
1. Focus on winning major cities in both large and small states.
2. Target influential counties outside major metropolitan areas.
3. Prioritize states with higher electoral votes while not neglecting smaller states that could be crucial in a close race.
4. Tailor campaign messages to resonate with urban and rural voters in each state.

Conclusion

This hypothetical scenario assumes strong performance in both urban areas and significant smaller counties across various states. The inclusion of smaller states provides additional pathways to reach or exceed the 270 electoral vote threshold. However, this remains a highly optimistic and simplified scenario for illustrative purposes only. Actual electoral outcomes would depend on numerous complex factors including voter turnout, campaign effectiveness, current political climate, and many other variables that cannot be accurately predicted.
"""



output_file = "C:/Users/William Parker/OneDrive/Documents/pdf_to_pretty/enhanced_rfk_scenario.pdf"
create_professional_pdf(content, output_file)
print(f"Enhanced PDF saved to: {output_file}")