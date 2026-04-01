import os
import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin, urlparse

def download_file(url, base_folder):
    try:
        response = requests.get(url, stream=True)
        response.raise_for_status()
        
        parsed_url = urlparse(url)
        path = parsed_url.path
        if not path or path.endswith('/'):
            path += 'index.html'
            
        local_path = os.path.join(base_folder, path.lstrip('/'))
        os.makedirs(os.path.dirname(local_path), exist_ok=True)
        
        with open(local_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
        return path.lstrip('/')
    except Exception as e:
        print(f"Error downloading {url}: {e}")
        return None

def mirror_site(base_url, target_dir):
    print(f"Starting mirror of {base_url} into {target_dir}")
    os.makedirs(target_dir, exist_ok=True)
    response = requests.get(base_url)
    response.raise_for_status()
    
    soup = BeautifulSoup(response.text, 'html.parser')
    
    # Tags and attributes to look for
    tags = {
        'img': 'src',
        'link': 'href',
        'script': 'src',
        'source': 'src',
        'video': 'src'
    }
    
    for tag, attr in tags.items():
        for element in soup.find_all(tag, **{attr: True}):
            original_url = element[attr]
            url = urljoin(base_url, original_url)
            parsed_url = urlparse(url)
            
            # Download if it's local or from Squarespace CDNs
            if parsed_url.netloc == urlparse(base_url).netloc or 'images.squarespace-cdn.com' in url or 'static1.squarespace.com' in url:
                print(f"Downloading {url}...")
                local_path = download_file(url, target_dir)
                if local_path:
                    element[attr] = local_path

    # Save index.html
    index_path = os.path.join(target_dir, 'index.html')
    with open(index_path, 'w') as f:
        f.write(soup.prettify())
    print(f"Saved index to {index_path}")

if __name__ == "__main__":
    # Use absolute path for safety
    base_dir = os.path.dirname(os.path.abspath(__file__))
    static_dir = os.path.join(base_dir, 'static')
    mirror_site('https://lobster-bird-d3bn.squarespace.com/', static_dir)
