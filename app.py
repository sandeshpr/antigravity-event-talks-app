import os
import time
import xml.etree.ElementTree as ET
import requests
from bs4 import BeautifulSoup
from flask import Flask, jsonify, render_template, request

app = Flask(__name__)

# In-memory cache for release notes
CACHE_DURATION = 300  # Cache for 5 minutes (300 seconds)
feed_cache = {
    "data": None,
    "last_updated": 0
}

def parse_content_to_updates(entry_id, date, updated_time, link, html_content):
    """
    Parses the CDATA HTML content from an Atom entry, splitting it into
    individual updates based on header tags (h2, h3, h4) representing update types.
    """
    if not html_content:
        return []
        
    soup = BeautifulSoup(html_content, 'html.parser')
    updates = []
    
    current_type = "General"
    current_html = []
    idx = 0
    
    # Iterate through child nodes to group siblings under their headers
    for child in soup.children:
        # Check if the child is a tag and has one of the heading names
        if child.name in ['h2', 'h3', 'h4']:
            # Save the accumulated section before starting a new one
            accumulated_html = "".join(str(c) for c in current_html).strip()
            temp_soup = BeautifulSoup(accumulated_html, 'html.parser')
            temp_text = temp_soup.get_text().strip()
            
            if accumulated_html and (temp_text or current_type != "General"):
                updates.append({
                    "id": f"{entry_id}_{idx}",
                    "date": date,
                    "raw_date": updated_time,
                    "type": current_type,
                    "content_html": accumulated_html,
                    "content_text": temp_text,
                    "link": link
                })
                idx += 1
            
            # Update type to the header text and reset content accumulator
            current_type = child.get_text().strip()
            current_html = []
        else:
            current_html.append(child)
            
    # Save the final accumulated section
    accumulated_html = "".join(str(c) for c in current_html).strip()
    temp_soup = BeautifulSoup(accumulated_html, 'html.parser')
    temp_text = temp_soup.get_text().strip()
    
    if accumulated_html and (temp_text or current_type != "General" or idx == 0):
        updates.append({
            "id": f"{entry_id}_{idx}",
            "date": date,
            "raw_date": updated_time,
            "type": current_type,
            "content_html": accumulated_html,
            "content_text": temp_text,
            "link": link
        })
        
    return updates

def fetch_and_parse_feed():
    """
    Fetches the BigQuery release notes XML feed and parses it.
    """
    url = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    response = requests.get(url, headers=headers, timeout=15)
    response.raise_for_status()
    
    # Parse XML
    root = ET.fromstring(response.content)
    
    # Atom namespace
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    
    entries = root.findall('atom:entry', ns)
    all_updates = []
    
    for entry in entries:
        title_el = entry.find('atom:title', ns)
        id_el = entry.find('atom:id', ns)
        updated_el = entry.find('atom:updated', ns)
        content_el = entry.find('atom:content', ns)
        
        # Link alternate
        link_el = entry.find("atom:link[@rel='alternate']", ns)
        if link_el is None:
            link_el = entry.find('atom:link', ns)
            
        title = title_el.text if title_el is not None else "Unknown Date"
        entry_id = id_el.text if id_el is not None else ""
        updated_time = updated_el.text if updated_el is not None else ""
        link = link_el.get('href') if link_el is not None else "https://cloud.google.com/bigquery/docs/release-notes"
        content_html = content_el.text if content_el is not None else ""
        
        # Parse content_html into individual updates
        entry_updates = parse_content_to_updates(entry_id, title, updated_time, link, content_html)
        all_updates.extend(entry_updates)
        
    return all_updates

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/notes')
def get_notes():
    global feed_cache
    
    # Check if force refresh is requested
    force_refresh = request.args.get('refresh', 'false').lower() == 'true'
    now = time.time()
    
    # Serve cached data if valid and no force refresh requested
    if not force_refresh and feed_cache["data"] is not None and (now - feed_cache["last_updated"]) < CACHE_DURATION:
        return jsonify({
            "status": "success",
            "source": "cache",
            "last_updated": feed_cache["last_updated"],
            "data": feed_cache["data"]
        })
        
    try:
        data = fetch_and_parse_feed()
        feed_cache["data"] = data
        feed_cache["last_updated"] = now
        
        return jsonify({
            "status": "success",
            "source": "network",
            "last_updated": now,
            "data": data
        })
    except Exception as e:
        # Fallback to cache if request fails
        if feed_cache["data"] is not None:
            return jsonify({
                "status": "partial_success",
                "source": "stale_cache",
                "error": str(e),
                "last_updated": feed_cache["last_updated"],
                "data": feed_cache["data"]
            })
        else:
            return jsonify({
                "status": "error",
                "message": f"Failed to fetch feed: {str(e)}"
            }), 500

if __name__ == '__main__':
    # Defaulting to localhost:5000
    app.run(host='127.0.0.1', port=5000, debug=True)
