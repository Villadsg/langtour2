import os
import json
from supabase import create_client, Client

# Tour data from the request
tours_data = [
    {
        "name": "Royal Madrid: Palaces and Power",
        "cityId": "madrid",
        "language": "Spanish",
        "description": "Explore Madrid's royal heritage while practicing Spanish vocabulary related to monarchy, architecture, and history. Begin at the magnificent Royal Palace (Palacio Real), the largest functioning royal palace in Europe, learning about Spanish royal traditions and ceremonial language. Continue to Plaza de Oriente and the Royal Theatre, discussing the arts and their royal patronage. Visit the Royal Monastery of La Encarnación and the Royal Basilica of San Francisco el Grande. Throughout the tour, you'll practice formal Spanish expressions and vocabulary related to royalty, government, and historical events."
    },
    {
        "name": "Art and Expression: Madrid's Golden Triangle",
        "cityId": "madrid",
        "language": "Spanish",
        "description": "Enhance your Spanish vocabulary through the world of art at Madrid's famous museum district. Begin at the Prado Museum, learning to discuss masterpieces by Velázquez, Goya, and El Greco in Spanish. Continue to the Thyssen-Bornemisza Museum, expanding your vocabulary with more modern artistic movements. Conclude at the Reina Sofía Museum, home to Picasso's Guernica, where you'll practice discussing emotions, politics, and symbolism in Spanish. Throughout the tour, you'll develop specialized vocabulary for describing colors, techniques, compositions, and the historical contexts of various artworks."
    },
    {
        "name": "Literary Madrid: Words and Wanderings",
        "cityId": "madrid",
        "language": "Spanish",
        "description": "Walk in the footsteps of Spain's greatest writers while improving your Spanish vocabulary. Begin at the Barrio de las Letras (Literary Quarter), home to Golden Age writers like Cervantes, Lope de Vega, and Quevedo. Visit Cervantes' tomb at the Convent of the Barefoot Trinitarians and explore the house where Lope de Vega lived for 25 years. Continue to historic cafés like Café Gijón, where literary tertulias (gatherings) have taken place for generations. The tour includes readings from famous Spanish works at significant locations, helping you connect language with literary history."
    },
    {
        "name": "Madrid's buildings on fire",
        "cityId": "madrid",
        "language": "Spanish",
        "description": "Discover Madrid's resilience through the stories of its rebuilt landmarks that rose from devastating fires. Visit the Plaza Mayor, which suffered multiple fires in 1631, 1672, and the Great Fire of 1790 that destroyed a third of the square. Explore the Royal Palace, built after the Alcázar of Madrid burned down on Christmas Eve 1734, destroying priceless artworks. Learn about the Teatro Real (Royal Theatre) that suffered fires in its history, and the Museo del Prado, which narrowly escaped destruction during the Spanish Civil War. This tour combines architectural history with vocabulary about fire, reconstruction, and urban planning in Spanish."
    },
    {
        "name": "Copenhagen's Culinary Language Journey",
        "cityId": "copenhagen",
        "language": "Danish",
        "description": "Combine Danish language learning with a culinary adventure through Copenhagen. Start at Torvehallerne food market to learn vocabulary for various foods and ingredients while sampling Danish specialties. Continue to a traditional smørrebrød restaurant to practice ordering these open-faced sandwiches in Danish. Visit a local bakery to learn about Danish pastries and the vocabulary associated with baking. The tour includes stops at both traditional and modern Danish eateries, providing a comprehensive introduction to Danish food culture and the language surrounding it."
    },
    {
        "name": "Hygge and History in Copenhagen",
        "cityId": "copenhagen",
        "language": "Danish",
        "description": "Experience the uniquely Danish concept of 'hygge' while exploring Copenhagen's historic neighborhoods. Begin in the colorful Nyhavn district, learning Danish phrases to describe the picturesque harbor. Continue through the medieval streets of the Latin Quarter, practicing conversation with stops at cozy cafés. Visit the Round Tower (Rundetårn) and practice vocabulary related to architecture and history. The tour concludes in the Royal Gardens of Rosenborg Castle, where you'll learn to discuss nature, seasons, and outdoor activities in Danish."
    },
    {
        "name": "Danish Royal History Walk",
        "cityId": "copenhagen",
        "language": "Danish",
        "description": "Immerse yourself in the rich history of the Danish monarchy as you explore Copenhagen's royal landmarks. Begin at Amalienborg Palace, the winter residence of the Danish royal family, where you'll learn about the changing of the Royal Guard. Continue to Rosenborg Castle to see the Crown Jewels and Royal Treasury. The tour includes visits to the Royal Reception Rooms at Christiansborg Palace and concludes at the Royal Library Garden. Throughout the tour, you'll practice Danish vocabulary related to royalty, government, and historical events."
    },
    {
        "name": "Copenhagen's Buildings on fire",
        "cityId": "copenhagen",
        "language": "Danish",
        "description": "Explore the fascinating history of Copenhagen's most significant buildings that have been destroyed by fire and rebuilt. Visit Christiansborg Palace, which burned down multiple times (1794, 1884) before its current incarnation. Learn about the devastating fire of 1728 that destroyed 28% of the city, and the 1795 fire that razed another 900 buildings. Discover how these disasters shaped Copenhagen's architectural identity and building regulations. The tour includes visits to the rebuilt Copenhagen University buildings, the Church of Our Lady (Vor Frue Kirke), and the story of the Amalienborg Palace fire of 1689."
    }
]

def main():
    # Get Supabase credentials
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    user_id = os.environ.get("USER_ID")
    
    # If credentials are not in environment variables, prompt for them
    if not url:
        url = input("Enter your Supabase URL: ")
    if not key:
        key = input("Enter your Supabase anon/service key: ")
    if not user_id:
        user_id = input("Enter your user ID (creator of the tours): ")
    
    # Validate inputs
    if not url or not key or not user_id:
        print("Error: Supabase URL, key, and user ID are required.")
        return
    
    try:
        # Initialize Supabase client
        supabase = create_client(url, key)
        
        # Insert tours into the database
        for tour in tours_data:
            # Format the data according to your schema
            tour_data = {
                "description": {
                    "name": tour["name"],
                    "cityId": tour["cityId"],
                    "language": tour["language"],
                    "description": tour["description"]
                },
                "creator_id": user_id
            }
            
            # Insert the tour
            result = supabase.table("tours").insert(tour_data).execute()
            
            # Print the result
            print(f"Added tour: {tour['name']}")
            if hasattr(result, 'error') and result.error:
                print(f"Error: {result.error}")
        
        print("\nAll tours have been added to the database!")
        
    except Exception as e:
        print(f"An error occurred: {str(e)}")

if __name__ == "__main__":
    main()
