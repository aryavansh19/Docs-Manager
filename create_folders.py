import json
import os
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

# If modifying these scopes, delete the file token.json.
SCOPES = ['https://www.googleapis.com/auth/drive']


def authenticate_drive():
    creds = None
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                'credentials.json', SCOPES)
            creds = flow.run_local_server(port=8090)
        with open('token.json', 'w') as token:
            token.write(creds.to_json())
    return build('drive', 'v3', credentials=creds)


def create_folder(service, name, parent_id=None):
    """Creates a folder and returns its ID."""
    file_metadata = {
        'name': name,
        'mimeType': 'application/vnd.google-apps.folder'
    }
    if parent_id:
        file_metadata['parents'] = [parent_id]

    file = service.files().create(body=file_metadata, fields='id').execute()
    print(f"Created Folder: {name} (ID: {file.get('id')})")
    return file.get('id')


# --- MAIN LOGIC ---

def setup_drive_structure(json_data):
    service = authenticate_drive()

    # 1. Create a Master "College Notes" Folder
    master_folder_id = create_folder(service, "College Smart Notes")

    # We will store the folder IDs in a dictionary to use later for sorting
    folder_map = {}

    # 2. Loop through Subjects
    for subject in json_data['subjects']:
        subj_name = subject['name']
        print(f"\nProcessing Subject: {subj_name}...")

        # Create Subject Folder inside Master Folder
        subj_id = create_folder(service, subj_name, master_folder_id)

        folder_map[subj_name] = {"id": subj_id, "units": {}}

        # 3. Loop through Units
        for unit_name in subject['units']:
            # Create Unit Folder inside Subject Folder
            # We truncate long names for folder clarity if needed
            short_name = unit_name[:50] + "..." if len(unit_name) > 50 else unit_name

            unit_id = create_folder(service, short_name, subj_id)
            folder_map[subj_name]["units"][unit_name] = unit_id

    # 4. Save this map! You need it for the WhatsApp bot later.
    with open("folder_map.json", "w") as f:
        json.dump(folder_map, f, indent=2)
    print("\n✅ Setup Complete! 'folder_map.json' saved.")


# PASTE THIS INTO create_folders.py

syllabus_data = {
    'subjects': [
        {
            'name': 'Machine Learning',
            'units': [
                'Review of Statistical Concepts, Introduction to Machine Learning, Introduction to Python',
                'Introduction to Exploratory Data Analysis, Data Transformation, Data Visualization',
                'Supervised Learning Algorithms',
                'Clustering, Dimensionality Reduction',
                'Model Evaluation and Selection, Hyperparameter Optimization Techniques'
            ]
        },
        {
            'name': 'Operating Systems',
            'units': [
                'Introduction to Operating Systems, UNIX',
                'Process Management',
                'Deadlocks',
                'Memory Management',
                'File System Management'
            ]
        },
        {
            'name': 'Database Management System',
            'units': [
                'Unit 1: Introduction to DBMS and Architecture',
                'Unit 2: Entity-Relationship Model',
                'Unit 3: Relational Model, Relational Algebra, SQL, and Optimization',
                'Unit 4: Database Design and Normalization',
                'Unit 5: Transaction Management and Crash Recovery'
            ]
        },
        {
            'name': 'Operating Systems Lab',
            'units': [
                'System calls for process management (FORK, WAIT)',
                'Process synchronization (PIPE, FIFO, MESSAGE QUEUE, SHARED MEMORY)',
                'CPU scheduling algorithms (FCFS, SJF, PRIORITY)',
                'Page replacement policies (FIFO, LRU)',
                'Command execution using pipes and exec()'
            ]
        },
        {
            'name': 'Database Management System Lab',
            'units': [
                'ER-Modeling and Table Conversion',
                'Data Definition and Manipulation (DDL, DML)',
                'Integrity Constraints and NULL values',
                'Advanced SQL: Joins, Aggregate Functions, and Subqueries',
                'Database Triggers and Case Studies (Hospital, Employee, Trainee records)'
            ]
        },
        {
            'name': 'Cloud-Based Application Development and Management',
            'units': [
                'Unit 1: Fundamental of Cloud Based Applications',
                'Unit 2: Cloud Platforms in Industry (AWS, Google App Engine, Azure)',
                'Unit 3: Advanced Cloud Computing (Energy Efficiency, Federation, Virtualization)',
                'Unit 4: Cloud Management (SLA, Billing, Governance, Analytics)',
                'Unit 5: Cloud Based Secured Applications Development'
            ]
        },
        {
            'name': 'Computer System Security',
            'units': [
                'Unit 1: Introduction to System security (Attacks and Vulnerabilities)',
                'Unit 2: Software security (Set-UID, Buffer Overflow, Race Conditions)',
                'Unit 3: Web Security (XSS, SQL Injection, CSRF, TLS)',
                'Unit 4: Smartphone Security (Android/iOS models, Malware detection)',
                'Unit 5: Hardware and system security (Meltdown, Spectre, SCADA security)'
            ]
        },
        {
            'name': 'Artificial Intelligence and Machine Learning',
            'units': [
                'Unit 01: Introduction to AI and Search Strategies',
                'Unit 02: Knowledge representation and reasoning',
                'Unit 3: Introduction to Machine Learning and Supervised Learning',
                'Unit 4: Clustering, Dimensionality Reduction, and Model Evaluation',
                'Unit 5: Problem Solving Agents and Adversarial Search'
            ]
        },
        {
            'name': 'Deep Learning Fundamentals',
            'units': [
                'History and Basics of Deep Learning',
                'Neural Network Basics and MLPs',
                'Gradient Descent and Backpropagation',
                'Regularization, Dropout, and Optimization Methods',
                'Convolutional Neural Networks (CNNs) and Architectures',
                'Recurrent Neural Networks (RNNs) and LSTMs'
            ]
        },
        {
            'name': 'Computer Vision',
            'units': [
                'Unit 1: Introduction to Image Processing and Computer Vision',
                'Unit 2: Image Processing / Low-Level Vision',
                'Unit 3: Mid-Level Vision',
                'Unit 4: High-Level Vision',
                'Unit 5: Applications of Image Processing and Computer Vision'
            ]
        },
        {
            'name': 'Introduction to Artificial Intelligence and Data Science',
            'units': [
                'Unit 01: Data Science History and Introduction to AI',
                'Unit 02: Data Preprocessing and Knowledge Reasoning',
                'Unit 3: Modelling Techniques (Supervised and Unsupervised Learning)',
                'Unit 4: Problem Solving and Search Methods',
                'Unit 5: Applications of Analytics and Expert Systems'
            ]
        },
        {
            'name': 'Computer Networks',
            'units': [
                'Unit 1: Introduction to Computer Networks and the Internet',
                'Unit 2: Application Layer (HTTP, DNS, P2P)',
                'Unit 3: Transport Layer (TCP, UDP, Congestion Control)',
                'Unit 4: Network Layer (IP, Routing Algorithms, DHCP, NAT)',
                'Unit 5: Link Layer and Local Area Networks (ARP, Ethernet, VLANs)'
            ]
        },
        {
            'name': 'Introduction to AI and DS Lab',
            'units': [
                'Data Wrangling and EDA',
                'Feature Selection and Informed/Uninformed Search',
                'Supervised and Unsupervised Learning Implementation',
                'Data Visualization and Sentiment Analysis',
                'Chatbot Development and Smart Application Case Studies'
            ]
        },
        {
            'name': 'Computer Networks Lab',
            'units': [
                'Network Utilities and Transmission Media (UTP cable preparation)',
                'Network Simulation and Topology Configuration (Packet Tracer)',
                'Protocol Analysis using Wireshark',
                'Static and Dynamic Routing (RIP, OSPF)',
                'Socket Programming (TCP/UDP Client-Server in C)'
            ]
        },
        {
            'name': 'Natural Language Processing and Computer Vision',
            'units': [
                'UNIT 1: Introduction to NLP and Text Processing',
                'UNIT 2: Syntax, Parsing, and Language Models',
                'UNIT 3: Sentiment Analysis and NLP Applications',
                'UNIT 4: Introduction to Computer Vision and Image Segmentation',
                'UNIT 5: Object Detection, Deep Learning for Vision, and Advanced Topics'
            ]
        },
        {
            'name': 'Computer System Security Lab',
            'units': [
                'Vulnerability Demonstrations (Buffer Overflow, Race Condition, Dirty Cow)',
                'Web Security Attacks (XSS, CSRF, SQL Injection)',
                'Network Security Tools (Burp Suite, Metasploit, Wireshark)',
                'Protocol Analysis (HTTPs, ICMP)',
                'Case Studies on Hardware Security and Side Channel Attacks'
            ]
        },
        {
            'name': 'Block chain Technology and its application',
            'units': [
                'Unit 1: Introduction to blockchain and Structure of blocks',
                'Unit 2: Application of cryptography to blockchain',
                'Unit 3: Distributed ledger and Consensus mechanisms',
                'Unit 4: Blockchain mining and Forking',
                'Unit 5: Ethereum and Applications in banking, healthcare, and IoT'
            ]
        },
        {
            'name': 'Big Data Visualization',
            'units': [
                'Unit 1: Techniques for visual data representations',
                'Unit 2: Editorial Focus, Conceiving and Reasoning',
                'Unit 3: Taxonomy of Data Visualization and Mapping Geospatial data',
                'Unit 4: Tools for data visualization (Tableau, Google Charts)',
                'Unit 5: Advanced Data Visualization through Tableau'
            ]
        },
        {
            'name': 'Reinforcement Learning',
            'units': [
                'UNIT 1: Introduction to Reinforcement Learning and MDPs',
                'UNIT 2: Dynamic Programming and Monte Carlo Methods',
                'UNIT 3: Temporal Difference Learning (SARSA, Q-learning)',
                'UNIT 4: Advanced RL Algorithms (DQN, Actor-Critic)',
                'UNIT 5: RL in Practice (Robotics, Games, Real-world applications)'
            ]
        }
    ]
}

if __name__ == '__main__':
    setup_drive_structure(syllabus_data)