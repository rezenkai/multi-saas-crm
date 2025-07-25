from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum

class DocumentType(str, Enum):
    FAQ = "faq"
    PRODUCT_DOCS = "product_docs"
    POLICY = "policy"
    CASE_STUDY = "case_study"
    TRAINING_MATERIAL = "training_material"
    SALES_PLAYBOOK = "sales_playbook"
    CUSTOMER_STORY = "customer_story"
    TECHNICAL_SPEC = "technical_spec"

class DocumentStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"
    UNDER_REVIEW = "under_review"

class KnowledgeDocumentRequest(BaseModel):
    title: str = Field(..., description="Document title")
    content: str = Field(..., description="Full document content")
    document_type: DocumentType
    tags: List[str] = Field(default_factory=list, description="Tags for categorization")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)
    source_url: Optional[str] = None
    author: Optional[str] = None
    department: Optional[str] = None

class KnowledgeDocumentResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    
    document_id: str
    title: str
    content: str
    document_type: DocumentType
    status: DocumentStatus
    tags: List[str]
    metadata: Dict[str, Any]
    
    # Vector embeddings info
    embedding_status: str = Field(..., description="processing|completed|failed")
    chunk_count: int = Field(0, description="Number of text chunks created")
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    version: int = 1

class RAGQueryRequest(BaseModel):
    query: str = Field(..., description="User question or query")
    context: Optional[str] = Field(None, description="Additional context about the query")
    
    # Query filters
    document_types: Optional[List[DocumentType]] = None
    tags: Optional[List[str]] = None
    departments: Optional[List[str]] = None
    
    # Response preferences
    max_results: int = Field(5, ge=1, le=20, description="Maximum number of results")
    include_citations: bool = True
    response_style: str = Field("helpful", description="helpful|concise|detailed|technical")
    
    # Customer context (for personalized responses)
    customer_id: Optional[str] = None
    customer_industry: Optional[str] = None
    customer_role: Optional[str] = None

class CitationSource(BaseModel):
    document_id: str
    title: str
    document_type: DocumentType
    relevance_score: float = Field(..., ge=0, le=1)
    excerpt: str = Field(..., description="Relevant text excerpt")
    chunk_index: int = Field(..., description="Which chunk in the document")

class RAGQueryResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    
    query: str
    answer: str = Field(..., description="Generated AI response")
    confidence_score: float = Field(..., ge=0, le=1, description="Response confidence")
    
    # Sources and citations
    sources: List[CitationSource] = Field(default_factory=list)
    total_sources_found: int
    
    # Response metadata
    response_time_ms: int
    tokens_used: int
    
    # Suggested follow-ups
    related_questions: List[str] = Field(default_factory=list)
    suggested_actions: List[str] = Field(default_factory=list)
    
    # Metadata
    generated_at: datetime = Field(default_factory=datetime.utcnow)
    model_version: str = "1.0"

class KnowledgeSearchRequest(BaseModel):
    query: str = Field(..., description="Search query")
    document_types: Optional[List[DocumentType]] = None
    tags: Optional[List[str]] = None
    limit: int = Field(10, ge=1, le=50)
    similarity_threshold: float = Field(0.7, ge=0.0, le=1.0)

class KnowledgeSearchResult(BaseModel):
    document_id: str
    title: str
    document_type: DocumentType
    relevance_score: float
    excerpt: str
    tags: List[str]
    
class KnowledgeSearchResponse(BaseModel):
    query: str
    results: List[KnowledgeSearchResult]
    total_found: int
    search_time_ms: int

class CustomerInsightRequest(BaseModel):
    customer_id: str
    query: str = Field(..., description="Question about the customer")
    include_historical_data: bool = True
    include_preferences: bool = True
    include_past_interactions: bool = True

class CustomerInsightResponse(BaseModel):
    customer_id: str
    insights: Dict[str, Any] = Field(default_factory=dict)
    recommendations: List[str] = Field(default_factory=list)
    risk_factors: List[str] = Field(default_factory=list)
    opportunities: List[str] = Field(default_factory=list)
    
    # Data sources
    data_sources: List[str] = Field(default_factory=list)
    confidence_level: float = Field(..., ge=0, le=1)
    
    generated_at: datetime = Field(default_factory=datetime.utcnow)